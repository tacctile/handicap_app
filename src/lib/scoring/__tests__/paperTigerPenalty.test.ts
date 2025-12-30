/**
 * Paper Tiger Circuit Breaker Penalty Tests
 *
 * Model B Part 5: Tests for the targeted penalty that downgrades horses
 * with Elite Speed but Zero Form and Mediocre Pace.
 */

import { describe, it, expect } from 'vitest';
import { calculatePaperTigerPenalty } from '../scoringUtils';

describe('calculatePaperTigerPenalty', () => {
  describe('Paper Tiger Detection (Should Apply -25 Penalty)', () => {
    it('applies penalty for Elite Speed (>120), Zero Form (<6), Mediocre Pace (<25)', () => {
      // Classic Paper Tiger: fast historical speed, no current form, no tactical edge
      expect(calculatePaperTigerPenalty(125, 3, 18)).toBe(-25);
    });

    it('applies penalty at threshold boundaries', () => {
      // Just above speed threshold (121), just below form threshold (5), just below pace (24)
      expect(calculatePaperTigerPenalty(121, 5, 24)).toBe(-25);
    });

    it('applies penalty for very high speed with zero form', () => {
      expect(calculatePaperTigerPenalty(140, 0, 10)).toBe(-25);
    });

    it('applies penalty for edge case form = 5', () => {
      expect(calculatePaperTigerPenalty(130, 5, 20)).toBe(-25);
    });
  });

  describe('Tessuto Rule (High Pace Protects)', () => {
    it('does NOT apply penalty when pace >= 25, even with zero form', () => {
      // High pace protects wire-to-wire threats off layoffs
      expect(calculatePaperTigerPenalty(130, 0, 25)).toBe(0);
    });

    it('does NOT apply penalty when pace is high (28) with elite speed and zero form', () => {
      expect(calculatePaperTigerPenalty(130, 0, 28)).toBe(0);
    });

    it('does NOT apply penalty when pace equals 25 exactly', () => {
      expect(calculatePaperTigerPenalty(125, 3, 25)).toBe(0);
    });

    it('does NOT apply penalty with max pace (35)', () => {
      expect(calculatePaperTigerPenalty(140, 0, 35)).toBe(0);
    });
  });

  describe('Normal Horses (Should NOT Apply Penalty)', () => {
    it('does NOT apply penalty when speed is not elite (<= 120)', () => {
      expect(calculatePaperTigerPenalty(120, 3, 18)).toBe(0);
      expect(calculatePaperTigerPenalty(100, 0, 10)).toBe(0);
    });

    it('does NOT apply penalty when form is good (>= 6)', () => {
      expect(calculatePaperTigerPenalty(130, 6, 18)).toBe(0);
      expect(calculatePaperTigerPenalty(140, 20, 10)).toBe(0);
    });

    it('does NOT apply penalty for average horse', () => {
      // Good speed with decent form
      expect(calculatePaperTigerPenalty(100, 25, 20)).toBe(0);
    });

    it('does NOT apply penalty when only speed is high', () => {
      // High speed but also good form
      expect(calculatePaperTigerPenalty(135, 30, 15)).toBe(0);
    });

    it('does NOT apply penalty for first-time starter (form = 0 but low speed)', () => {
      // First-time starter with no form or speed data
      expect(calculatePaperTigerPenalty(50, 0, 15)).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values correctly', () => {
      expect(calculatePaperTigerPenalty(0, 0, 0)).toBe(0);
    });

    it('handles maximum possible values', () => {
      // Max Model B values: Speed 105, Form 42, Pace 35
      expect(calculatePaperTigerPenalty(105, 42, 35)).toBe(0);
    });

    it('correctly identifies boundary at speed = 120', () => {
      // Speed = 120 is NOT elite (need > 120)
      expect(calculatePaperTigerPenalty(120, 0, 0)).toBe(0);
      // Speed = 121 IS elite
      expect(calculatePaperTigerPenalty(121, 0, 0)).toBe(-25);
    });

    it('correctly identifies boundary at form = 6', () => {
      // Form = 6 is NOT critical (need < 6)
      expect(calculatePaperTigerPenalty(130, 6, 10)).toBe(0);
      // Form = 5 IS critical
      expect(calculatePaperTigerPenalty(130, 5, 10)).toBe(-25);
    });

    it('correctly identifies boundary at pace = 25', () => {
      // Pace = 25 triggers Tessuto Rule (no penalty)
      expect(calculatePaperTigerPenalty(130, 0, 25)).toBe(0);
      // Pace = 24 does not trigger Tessuto Rule
      expect(calculatePaperTigerPenalty(130, 0, 24)).toBe(-25);
    });
  });

  describe('Real-World Scenarios', () => {
    it('Paper Tiger: horse with fast past figures but off layoff with no form', () => {
      // Horse had 130 beyer 8 months ago, now returning with no recent races
      // Low form (2), mediocre pace fit (18)
      expect(calculatePaperTigerPenalty(125, 2, 18)).toBe(-25);
    });

    it('Tessuto (Wire-to-Wire Threat): elite speed, zero form, but high pace', () => {
      // Speed horse off layoff who can wire the field
      // Zero form but high pace advantage (30)
      expect(calculatePaperTigerPenalty(130, 0, 30)).toBe(0);
    });

    it('Legitimate Contender: elite speed with good current form', () => {
      // Horse with great speed AND good recent form
      expect(calculatePaperTigerPenalty(135, 28, 20)).toBe(0);
    });

    it('Class Dropper: moderate speed but excellent form', () => {
      // Horse dropping in class with great form
      expect(calculatePaperTigerPenalty(90, 38, 25)).toBe(0);
    });
  });
});
