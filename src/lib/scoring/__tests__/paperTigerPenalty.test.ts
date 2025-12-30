/**
 * Paper Tiger Circuit Breaker Penalty Tests
 *
 * Model B Part 5/6: Tests for the targeted penalty that downgrades horses
 * with Elite Speed but Zero Form and Mediocre Pace.
 *
 * CALIBRATION (Part 6):
 * - Penalty: -50 points (kill shot to drop to mid-pack)
 * - Form threshold: < 10 (catches negligible form, not just zero)
 * - Pace safety: >= 30 (only Elite pace types protected)
 */

import { describe, it, expect } from 'vitest';
import { calculatePaperTigerPenalty } from '../scoringUtils';

describe('calculatePaperTigerPenalty', () => {
  describe('Paper Tiger Detection (Should Apply -50 Penalty)', () => {
    it('applies penalty for Elite Speed (>120), Low Form (<10), Non-Elite Pace (<30)', () => {
      // Classic Paper Tiger: fast historical speed, negligible form, no tactical edge
      expect(calculatePaperTigerPenalty(125, 5, 20)).toBe(-50);
    });

    it('applies penalty at threshold boundaries', () => {
      // Just above speed threshold (121), just below form threshold (9), just below pace (29)
      expect(calculatePaperTigerPenalty(121, 9, 29)).toBe(-50);
    });

    it('applies penalty for very high speed with zero form', () => {
      expect(calculatePaperTigerPenalty(140, 0, 15)).toBe(-50);
    });

    it('applies penalty for edge case form = 9 (negligible but not zero)', () => {
      expect(calculatePaperTigerPenalty(130, 9, 25)).toBe(-50);
    });

    it('applies penalty for Rio Grande type (massive speed advantage, zero form)', () => {
      // Rio Grande scenario: Elite speed (~201 base), zero form, mediocre pace
      expect(calculatePaperTigerPenalty(135, 3, 22)).toBe(-50);
    });

    it('applies penalty for Strongerthanbefore type (high speed, low form)', () => {
      // Strongerthanbefore scenario: Strong speed (~213 base), low form, okay pace
      expect(calculatePaperTigerPenalty(128, 5, 25)).toBe(-50);
    });

    it('NOW catches horses with "okay" pace (25-29) that were previously saved', () => {
      // Part 6 calibration: pace 25-29 no longer protected
      expect(calculatePaperTigerPenalty(125, 5, 25)).toBe(-50);
      expect(calculatePaperTigerPenalty(125, 5, 28)).toBe(-50);
      expect(calculatePaperTigerPenalty(125, 5, 29)).toBe(-50);
    });
  });

  describe('Tessuto Rule (Elite Pace >= 30 Protects)', () => {
    it('does NOT apply penalty when pace >= 30, even with zero form', () => {
      // Elite pace protects wire-to-wire threats off layoffs
      expect(calculatePaperTigerPenalty(130, 0, 30)).toBe(0);
    });

    it('does NOT apply penalty when pace is elite (32) with elite speed and zero form', () => {
      // Tessuto scenario: Elite speed, zero form, but DOMINANT pace (35)
      expect(calculatePaperTigerPenalty(130, 0, 32)).toBe(0);
    });

    it('does NOT apply penalty when pace equals 30 exactly', () => {
      expect(calculatePaperTigerPenalty(125, 5, 30)).toBe(0);
    });

    it('does NOT apply penalty with max pace (35) - Tessuto case', () => {
      // Tessuto had pace score of 35 - should always be protected
      expect(calculatePaperTigerPenalty(140, 0, 35)).toBe(0);
    });

    it('protects Tessuto-type winner (elite speed, low form, ELITE pace)', () => {
      // Tessuto: Won despite low form because of dominant front-running style
      expect(calculatePaperTigerPenalty(125, 3, 35)).toBe(0);
    });
  });

  describe('Normal Horses (Should NOT Apply Penalty)', () => {
    it('does NOT apply penalty when speed is not elite (<= 120)', () => {
      expect(calculatePaperTigerPenalty(120, 5, 20)).toBe(0);
      expect(calculatePaperTigerPenalty(100, 0, 15)).toBe(0);
    });

    it('does NOT apply penalty when form is good (>= 10)', () => {
      expect(calculatePaperTigerPenalty(130, 10, 20)).toBe(0);
      expect(calculatePaperTigerPenalty(140, 25, 15)).toBe(0);
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

    it('does NOT apply penalty for Mad Pursuit type (mediocre form, not critical)', () => {
      // Mad Pursuit had form = 20, which is above threshold
      expect(calculatePaperTigerPenalty(125, 20, 22)).toBe(0);
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
      expect(calculatePaperTigerPenalty(121, 0, 0)).toBe(-50);
    });

    it('correctly identifies boundary at form = 10', () => {
      // Form = 10 is NOT negligible (need < 10)
      expect(calculatePaperTigerPenalty(130, 10, 15)).toBe(0);
      // Form = 9 IS negligible
      expect(calculatePaperTigerPenalty(130, 9, 15)).toBe(-50);
    });

    it('correctly identifies boundary at pace = 30', () => {
      // Pace = 30 triggers Tessuto Rule (no penalty)
      expect(calculatePaperTigerPenalty(130, 0, 30)).toBe(0);
      // Pace = 29 does not trigger Tessuto Rule
      expect(calculatePaperTigerPenalty(130, 0, 29)).toBe(-50);
    });
  });

  describe('Real-World Scenarios (Calibrated for Part 6)', () => {
    it('Paper Tiger Rio Grande: elite speed, zero form, mediocre pace -> KILLED', () => {
      // Rio Grande: ~201 base, took -25 but stayed #1. Now takes -50 -> drops to mid-pack
      expect(calculatePaperTigerPenalty(130, 3, 22)).toBe(-50);
    });

    it('Paper Tiger Strongerthanbefore: strong speed, low form, okay pace -> KILLED', () => {
      // Strongerthanbefore: ~213 base, took -25 but stayed #2. Now takes -50 -> drops
      expect(calculatePaperTigerPenalty(125, 5, 26)).toBe(-50);
    });

    it('Tessuto (Winner): elite speed, low form, ELITE pace -> PROTECTED', () => {
      // Tessuto: Won Race 6. Pace = 35 protects him from penalty
      expect(calculatePaperTigerPenalty(125, 3, 35)).toBe(0);
    });

    it('Legitimate Contender: elite speed with good current form -> NO PENALTY', () => {
      // Horse with great speed AND good recent form (form >= 10)
      expect(calculatePaperTigerPenalty(135, 28, 20)).toBe(0);
    });

    it('Class Dropper: moderate speed but excellent form -> NO PENALTY', () => {
      // Horse dropping in class with great form (speed not elite)
      expect(calculatePaperTigerPenalty(90, 38, 25)).toBe(0);
    });

    it('Fringe case: just under all thresholds -> PENALIZED', () => {
      // Speed 121, Form 9, Pace 29 - all just under thresholds
      expect(calculatePaperTigerPenalty(121, 9, 29)).toBe(-50);
    });

    it('Fringe case: form exactly 10 -> NOT PENALIZED (borderline acceptable)', () => {
      // Form = 10 is the minimum acceptable form score
      expect(calculatePaperTigerPenalty(130, 10, 20)).toBe(0);
    });
  });

  describe('Penalty Magnitude Verification', () => {
    it('penalty is exactly -50 points (kill shot)', () => {
      const penalty = calculatePaperTigerPenalty(130, 5, 20);
      expect(penalty).toBe(-50);
      expect(Math.abs(penalty)).toBe(50);
    });

    it('penalty is severe enough to drop horse ~2-3 ranks', () => {
      // A -50 point penalty on a 200+ base score horse should drop them significantly
      const baseScore = 210;
      const penalty = calculatePaperTigerPenalty(130, 5, 20);
      const adjustedScore = baseScore + penalty;
      expect(adjustedScore).toBe(160); // From elite (210) to contender range (160)
    });
  });
});
