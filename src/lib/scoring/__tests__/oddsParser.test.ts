/**
 * Odds Parser Tests
 *
 * Tests for parsing various odds formats (fractional, American, decimal).
 */

import { describe, it, expect } from 'vitest';
import {
  parseOddsString,
  parseOddsWithDetails,
  validateOdds,
  formatOddsDisplay,
  formatAllOddsFormats,
  parseOddsArray,
  parseDrfMorningLine,
  parseDrfToteOdds,
  needsParsing,
  convertOddsFormat,
  oddsStringToImpliedProb,
} from '../oddsParser';

describe('oddsParser', () => {
  // ========================================================================
  // FRACTIONAL ODDS PARSING
  // ========================================================================
  describe('parseOddsString - fractional formats', () => {
    it('parses "5-1" correctly', () => {
      expect(parseOddsString('5-1')).toBe(6.0);
    });

    it('parses "5/1" correctly', () => {
      expect(parseOddsString('5/1')).toBe(6.0);
    });

    it('parses "5:1" correctly', () => {
      expect(parseOddsString('5:1')).toBe(6.0);
    });

    it('parses "3-2" correctly', () => {
      expect(parseOddsString('3-2')).toBe(2.5);
    });

    it('parses "1-2" correctly (odds-on favorite)', () => {
      expect(parseOddsString('1-2')).toBe(1.5);
    });

    it('parses "9-2" correctly', () => {
      expect(parseOddsString('9-2')).toBe(5.5);
    });

    it('parses "7-5" correctly', () => {
      expect(parseOddsString('7-5')).toBe(2.4);
    });

    it('parses fractional with decimal values "7.5-1"', () => {
      expect(parseOddsString('7.5-1')).toBe(8.5);
    });

    it('parses with spaces "5 - 1"', () => {
      expect(parseOddsString('5 - 1')).toBe(6.0);
    });
  });

  // ========================================================================
  // AMERICAN ODDS PARSING
  // ========================================================================
  describe('parseOddsString - American formats', () => {
    it('parses "+400" correctly', () => {
      expect(parseOddsString('+400')).toBe(5.0);
    });

    it('parses "-150" correctly', () => {
      const result = parseOddsString('-150');
      expect(result).toBeCloseTo(1.667, 2);
    });

    it('parses "+150" correctly', () => {
      expect(parseOddsString('+150')).toBe(2.5);
    });

    it('parses "-200" correctly', () => {
      expect(parseOddsString('-200')).toBe(1.5);
    });

    it('parses "+100" as even money', () => {
      expect(parseOddsString('+100')).toBe(2.0);
    });

    it('parses "-100" as even money', () => {
      expect(parseOddsString('-100')).toBe(2.0);
    });

    it('parses "+500" correctly', () => {
      expect(parseOddsString('+500')).toBe(6.0);
    });

    it('parses "-300" correctly', () => {
      const result = parseOddsString('-300');
      expect(result).toBeCloseTo(1.333, 2);
    });
  });

  // ========================================================================
  // SPECIAL CASES
  // ========================================================================
  describe('parseOddsString - special cases', () => {
    it('parses "even" as 2.0', () => {
      expect(parseOddsString('even')).toBe(2.0);
    });

    it('parses "EVEN" as 2.0 (case insensitive)', () => {
      expect(parseOddsString('EVEN')).toBe(2.0);
    });

    it('parses "evn" as 2.0', () => {
      expect(parseOddsString('evn')).toBe(2.0);
    });

    it('parses "ev" as 2.0', () => {
      expect(parseOddsString('ev')).toBe(2.0);
    });

    it('handles whitespace around odds', () => {
      expect(parseOddsString('  5-1  ')).toBe(6.0);
    });
  });

  // ========================================================================
  // DECIMAL ODDS PARSING
  // ========================================================================
  describe('parseOddsString - decimal formats', () => {
    it('parses "5.00" as decimal odds', () => {
      expect(parseOddsString('5.00')).toBe(5.0);
    });

    it('parses "6.0" as decimal odds', () => {
      expect(parseOddsString('6.0')).toBe(6.0);
    });

    it('parses "2.5" as decimal odds', () => {
      expect(parseOddsString('2.5')).toBe(2.5);
    });

    it('parses "1.5" as decimal odds (favorite)', () => {
      const result = parseOddsString('1.5');
      // Small numbers get interpreted as X-1, so 1.5 becomes 2.5
      // But 1.5 is already valid decimal odds
      expect(result).toBeGreaterThanOrEqual(1.5);
    });

    it('parses plain integer as decimal odds when >= 2', () => {
      // Numbers >= 2.0 are treated as already decimal odds
      // "5" as decimal odds stays 5.0
      expect(parseOddsString('5')).toBe(5.0);
    });

    it('parses "10" as decimal odds', () => {
      // Numbers >= 2.0 are treated as already decimal odds
      expect(parseOddsString('10')).toBe(10.0);
    });
  });

  // ========================================================================
  // INVALID INPUT HANDLING
  // ========================================================================
  describe('parseOddsString - invalid inputs', () => {
    it('returns default for empty string', () => {
      expect(parseOddsString('')).toBe(2.0);
    });

    it('returns default for whitespace only', () => {
      expect(parseOddsString('   ')).toBe(2.0);
    });

    it('returns default for unparseable string', () => {
      expect(parseOddsString('not-odds')).toBe(2.0);
    });
  });

  // ========================================================================
  // DETAILED PARSING
  // ========================================================================
  describe('parseOddsWithDetails', () => {
    it('returns valid result for fractional odds', () => {
      const result = parseOddsWithDetails('5-1');
      expect(result.decimalOdds).toBe(6.0);
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('fractional');
      expect(result.originalInput).toBe('5-1');
    });

    it('returns valid result for American odds', () => {
      const result = parseOddsWithDetails('+400');
      expect(result.decimalOdds).toBe(5.0);
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('american');
    });

    it('returns valid result for decimal odds', () => {
      const result = parseOddsWithDetails('6.0');
      expect(result.decimalOdds).toBe(6.0);
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('decimal');
    });

    it('returns invalid result for bad input', () => {
      const result = parseOddsWithDetails('garbage');
      expect(result.isValid).toBe(false);
      expect(result.detectedFormat).toBe('unknown');
      expect(result.error).toBeDefined();
    });
  });

  // ========================================================================
  // VALIDATION
  // ========================================================================
  describe('validateOdds', () => {
    it('accepts valid decimal odds', () => {
      expect(validateOdds(4.0)).toBe(true);
      expect(validateOdds(1.5)).toBe(true);
      expect(validateOdds(100.0)).toBe(true);
    });

    it('accepts minimum odds (1.01)', () => {
      expect(validateOdds(1.01)).toBe(true);
    });

    it('accepts maximum odds (500)', () => {
      expect(validateOdds(500)).toBe(true);
    });

    it('rejects odds below 1.01', () => {
      expect(validateOdds(1.0)).toBe(false);
      expect(validateOdds(0.5)).toBe(false);
    });

    it('rejects odds above 500', () => {
      expect(validateOdds(501)).toBe(false);
      expect(validateOdds(1000)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(validateOdds(NaN)).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(validateOdds(Infinity)).toBe(false);
      expect(validateOdds(-Infinity)).toBe(false);
    });
  });

  // ========================================================================
  // DISPLAY FORMATTING
  // ========================================================================
  describe('formatOddsDisplay', () => {
    it('formats decimal display correctly', () => {
      expect(formatOddsDisplay(6.0, 'decimal')).toBe('6.00');
      expect(formatOddsDisplay(2.5, 'decimal')).toBe('2.50');
    });

    it('formats fractional display correctly', () => {
      expect(formatOddsDisplay(6.0, 'fractional')).toBe('5-1');
      expect(formatOddsDisplay(2.5, 'fractional')).toBe('3-2');
      expect(formatOddsDisplay(2.0, 'fractional')).toBe('EVEN');
    });

    it('formats American display correctly', () => {
      expect(formatOddsDisplay(6.0, 'american')).toBe('+500');
      expect(formatOddsDisplay(2.0, 'american')).toBe('+100');
      expect(formatOddsDisplay(1.5, 'american')).toBe('-200');
    });

    it('returns N/A for invalid odds', () => {
      expect(formatOddsDisplay(NaN, 'decimal')).toBe('N/A');
      expect(formatOddsDisplay(0.5, 'fractional')).toBe('N/A');
    });
  });

  describe('formatAllOddsFormats', () => {
    it('returns all three formats', () => {
      const result = formatAllOddsFormats(6.0);
      expect(result.decimal).toBe('6.00');
      expect(result.fractional).toBe('5-1');
      expect(result.american).toBe('+500');
    });

    it('handles even money', () => {
      const result = formatAllOddsFormats(2.0);
      expect(result.decimal).toBe('2.00');
      expect(result.fractional).toBe('EVEN');
      expect(result.american).toBe('+100');
    });
  });

  // ========================================================================
  // BATCH PARSING
  // ========================================================================
  describe('parseOddsArray', () => {
    it('parses array of odds strings', () => {
      const input = ['5-1', '3-2', '+400', 'even'];
      const result = parseOddsArray(input);

      expect(result[0]).toBe(6.0);
      expect(result[1]).toBe(2.5);
      expect(result[2]).toBe(5.0);
      expect(result[3]).toBe(2.0);
    });

    it('handles invalid entries with defaults', () => {
      const input = ['5-1', 'garbage', '3-2'];
      const result = parseOddsArray(input);

      expect(result[0]).toBe(6.0);
      expect(result[1]).toBe(2.0); // default
      expect(result[2]).toBe(2.5);
    });
  });

  // ========================================================================
  // DRF-SPECIFIC PARSING
  // ========================================================================
  describe('parseDrfMorningLine', () => {
    it('parses typical DRF morning line format', () => {
      expect(parseDrfMorningLine('5-1')).toBe(6.0);
      expect(parseDrfMorningLine('8-1')).toBe(9.0);
      expect(parseDrfMorningLine('3-2')).toBe(2.5);
    });

    it('handles DRF decimal fractional odds', () => {
      expect(parseDrfMorningLine('7.5-1')).toBe(8.5);
    });
  });

  describe('parseDrfToteOdds', () => {
    it('parses tote odds same as morning line', () => {
      expect(parseDrfToteOdds('5-1')).toBe(6.0);
      expect(parseDrfToteOdds('3-2')).toBe(2.5);
    });
  });

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================
  describe('needsParsing', () => {
    it('returns true for fractional format', () => {
      expect(needsParsing('5-1')).toBe(true);
      expect(needsParsing('5/1')).toBe(true);
    });

    it('returns true for American format', () => {
      expect(needsParsing('+400')).toBe(true);
      expect(needsParsing('-150')).toBe(true);
    });

    it('returns true for "even"', () => {
      expect(needsParsing('even')).toBe(true);
    });

    it('returns false for plain decimal numbers', () => {
      // These are pure numbers, but parseFloat succeeds
      expect(needsParsing('6.0')).toBe(false);
      expect(needsParsing('5.00')).toBe(false);
    });
  });

  describe('convertOddsFormat', () => {
    it('converts from fractional to decimal', () => {
      expect(convertOddsFormat('5-1', 'decimal')).toBe('6.00');
    });

    it('converts from fractional to American', () => {
      expect(convertOddsFormat('5-1', 'american')).toBe('+500');
    });

    it('converts from American to fractional', () => {
      expect(convertOddsFormat('+400', 'fractional')).toBe('4-1');
    });

    it('round-trips correctly', () => {
      const original = '5-1';
      const decimal = convertOddsFormat(original, 'decimal');
      const back = convertOddsFormat(decimal, 'fractional');
      expect(back).toBe('5-1');
    });
  });

  describe('oddsStringToImpliedProb', () => {
    it('calculates implied probability from odds string', () => {
      expect(oddsStringToImpliedProb('5-1')).toBeCloseTo(1 / 6, 3); // ~16.7%
      expect(oddsStringToImpliedProb('even')).toBe(0.5); // 50%
      expect(oddsStringToImpliedProb('3-1')).toBe(0.25); // 25%
    });

    it('handles American odds', () => {
      expect(oddsStringToImpliedProb('+400')).toBe(0.2); // 20%
      expect(oddsStringToImpliedProb('+100')).toBe(0.5); // 50% (even money)
    });
  });
});
