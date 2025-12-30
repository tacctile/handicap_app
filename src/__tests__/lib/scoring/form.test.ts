/**
 * Form Scoring Tests
 * Tests layoff calculations, recent form patterns, and consistency bonuses
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFormScore,
  isOnHotStreak,
  getFormSummary,
  type ClassContext,
} from '../../../lib/scoring/form';
import {
  createHorseEntry,
  createPastPerformance,
  createLayoffHorse,
  createFirstTimeStarter,
} from '../../fixtures/testHelpers';

describe('Form Scoring', () => {
  // NOTE: v3.2 Model B - Speed-dominant scoring rebalance
  // - Recent form: 0-15 pts (reduced from 18)
  // - Winner bonuses: 0-20 pts (reduced from 28)
  // - Consistency: 0-4 pts (unchanged)
  // - Layoff: penalty-based (-10 to 0)
  // - Win Recency: 0-3 pts (reduced from 4)
  describe('Layoff Calculations', () => {
    // v3.0: Layoff now uses penalty system, but layoffScore returns legacy score for backward compat
    // Penalty of 0 = 13 pts, penalty of -3 = 10 pts, penalty of -6 = 7 pts, penalty of -10 = 3 pts
    it('returns 13 points (max) for optimal layoff (7-35 days)', () => {
      const horse = createLayoffHorse(21);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(13);
      expect(result.reasoning).toContain('Optimal layoff');
    });

    it('returns 13 points for 7-day layoff', () => {
      const horse = createLayoffHorse(7);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(13);
    });

    it('returns 13 points for 35-day layoff', () => {
      const horse = createLayoffHorse(35);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(13);
    });

    it('returns 10 points for 36-60 day layoff (short freshening)', () => {
      const horse = createLayoffHorse(45);

      const result = calculateFormScore(horse);

      // v3.0: -3 penalty = 13 - 3 = 10 pts
      expect(result.layoffScore).toBe(10);
      expect(result.reasoning).toContain('freshening');
    });

    it('returns 7 points for 61-90 day layoff', () => {
      const horse = createLayoffHorse(75);

      const result = calculateFormScore(horse);

      // v3.0: -6 penalty = 13 - 6 = 7 pts
      expect(result.layoffScore).toBe(7);
      expect(result.reasoning).toContain('Moderate layoff');
    });

    it('returns 3+ points for 180+ day extended layoff (capped penalty)', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 180,
        pastPerformances: [
          createPastPerformance({ daysSinceLast: 180, finishPosition: 5 }),
          createPastPerformance({ daysSinceLast: 30, finishPosition: 3 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: -10 penalty (capped) = 13 - 10 = 3 pts min
      expect(result.layoffScore).toBeGreaterThanOrEqual(3);
      expect(result.layoffScore).toBeLessThanOrEqual(8); // Could be higher if won off layoff
    });

    it('returns 11 points for quick turnback (<7 days)', () => {
      const horse = createLayoffHorse(5);

      const result = calculateFormScore(horse);

      // v3.0: -2 penalty = 13 - 2 = 11 pts
      expect(result.layoffScore).toBe(11);
      expect(result.reasoning).toContain('Quick turnback');
    });

    it('returns 11 points for first-time starter', () => {
      const horse = createFirstTimeStarter();

      const result = calculateFormScore(horse);

      // v3.0: -2 penalty = 13 - 2 = 11 pts
      expect(result.layoffScore).toBe(11);
      expect(result.reasoning).toContain('First');
    });

    it('adds bonus for horse with winning off layoff history', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 120,
        pastPerformances: [
          createPastPerformance({ daysSinceLast: 120, finishPosition: 4 }),
          createPastPerformance({ daysSinceLast: 90, finishPosition: 1 }), // Won off layoff
          createPastPerformance({ daysSinceLast: 21, finishPosition: 2 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: Won off layoff = -5 penalty instead of -10 = 8 pts
      expect(result.layoffScore).toBeGreaterThan(3);
      expect(result.reasoning).toContain('won fresh');
    });
  });

  describe('Recent Form Patterns', () => {
    // v3.2: Recent form max reduced from 18 to 15 pts
    it('returns 15 points (max) for recent win', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance({ finishPosition: 1, lengthsBehind: 0 })],
      });

      const result = calculateFormScore(horse);

      // v3.2: Max recent form is now 15 (was 18)
      expect(result.recentFormScore).toBe(15);
    });

    it('returns 8 points for first-time starter (neutral)', () => {
      const horse = createFirstTimeStarter();

      const result = calculateFormScore(horse);

      // v3.2: Neutral reduced from 9 to 8
      expect(result.recentFormScore).toBe(8);
    });

    it('weights most recent race higher (50%)', () => {
      // Recent win followed by poor races should still score well
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // 50% weight = 15 * 0.5 = 7.5
          createPastPerformance({ finishPosition: 10 }), // 30% weight = 3 * 0.3 = 0.9
          createPastPerformance({ finishPosition: 10 }), // 20% weight = 3 * 0.2 = 0.6
        ],
      });

      const result = calculateFormScore(horse);

      // v3.2: 15*0.5 + 3*0.3 + 3*0.2 = 7.5 + 0.9 + 0.6 = 9 (rounded)
      expect(result.recentFormScore).toBeGreaterThanOrEqual(8);
    });

    it('gives higher score for close 2nd place (within 2 lengths)', () => {
      const closeSecond = createHorseEntry({
        pastPerformances: [createPastPerformance({ finishPosition: 2, lengthsBehind: 1.5 })],
      });

      const wideSecond = createHorseEntry({
        pastPerformances: [createPastPerformance({ finishPosition: 2, lengthsBehind: 5 })],
      });

      const closeResult = calculateFormScore(closeSecond);
      const wideResult = calculateFormScore(wideSecond);

      expect(closeResult.recentFormScore).toBeGreaterThan(wideResult.recentFormScore);
    });
  });

  describe('Consistency Bonus', () => {
    // v3.0: Consistency max reduced from 7 to 4 pts
    it('returns 4 point bonus for 3+ consecutive ITM finishes (hot streak)', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: Max consistency is now 4 (was 7)
      expect(result.consistencyBonus).toBe(4);
      expect(result.itmStreak).toBe(4);
      expect(result.reasoning).toContain('Hot streak');
    });

    it('returns 4 point bonus for 2 consecutive ITM finishes with high ITM rate', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Breaks streak
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: 2/3 = 67% ITM rate → 4 pts (50%+ threshold)
      expect(result.consistencyBonus).toBe(4);
      expect(result.itmStreak).toBe(2);
    });

    it('returns ITM rate based bonus for 1 ITM with moderate rate', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Not ITM
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: 1/2 = 50% ITM rate → 4 pts
      expect(result.consistencyBonus).toBe(4);
      expect(result.itmStreak).toBe(1);
    });

    it('returns 0 bonus for no recent ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 6 }),
          createPastPerformance({ finishPosition: 4 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.consistencyBonus).toBe(0);
      expect(result.itmStreak).toBe(0);
    });

    it('returns 4 bonus for high ITM rate (4/5) even without streak', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 4 }), // Not ITM - breaks streak
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.0: 4/5 = 80% ITM rate → 4 pts (max)
      expect(result.consistencyBonus).toBe(4);
    });
  });

  describe('Form Trend Analysis', () => {
    it('detects improving form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Most recent - best
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 6 }), // Oldest - worst
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.formTrend).toBe('improving');
    });

    it('detects declining form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 8 }), // Most recent - worst
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 1 }), // Oldest - best
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.formTrend).toBe('declining');
    });

    it('detects steady form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.formTrend).toBe('steady');
    });

    it('returns unknown trend for insufficient data', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance({ finishPosition: 2 })],
      });

      const result = calculateFormScore(horse);

      expect(result.formTrend).toBe('unknown');
    });
  });

  describe('Total Score', () => {
    it('is capped at 42 points maximum', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21, // Optimal layoff = 0 penalty
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }), // Won last out + 2/3 + 3/5
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.2: Form cap reduced from 50 to 42
      expect(result.total).toBeLessThanOrEqual(42);
    });

    it('includes winner bonus in total calculation', () => {
      // Need 3+ PPs to get full confidence multiplier
      const horse = createHorseEntry({
        daysSinceLastRace: 21, // Optimal layoff
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 2, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 3, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      // v3.2: Total should include winner bonus
      // Recent form (15) + consistency (4) + winner bonus (12) + win recency (3) + no layoff penalty (0)
      expect(result.recentWinnerBonus).toBe(12); // Won last out
      expect(result.total).toBeGreaterThanOrEqual(30); // High total from winner bonus
    });
  });

  describe('isOnHotStreak', () => {
    it('returns true for 3+ consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });

      expect(isOnHotStreak(horse)).toBe(true);
    });

    it('returns false for 2 consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }),
        ],
      });

      expect(isOnHotStreak(horse)).toBe(false);
    });

    it('returns false for no past performances', () => {
      const horse = createFirstTimeStarter();

      expect(isOnHotStreak(horse)).toBe(false);
    });
  });

  describe('getFormSummary', () => {
    it('returns Hot for 3+ ITM streak', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      });

      const summary = getFormSummary(horse);

      expect(summary.label).toBe('Hot');
    });

    it('returns Improving for improving form', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 8 }),
        ],
      });

      const summary = getFormSummary(horse);

      expect(summary.label).toBe('Improving');
    });

    it('returns Declining for declining form', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 8 }),
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });

      const summary = getFormSummary(horse);

      expect(summary.label).toBe('Declining');
    });

    it('returns Layoff for extended layoff', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 120,
        pastPerformances: [createPastPerformance({ finishPosition: 5 })],
      });

      const summary = getFormSummary(horse);

      expect(summary.label).toBe('Layoff');
    });

    it('returns Steady for steady form', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 30,
        pastPerformances: [
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 4 }),
        ],
      });

      const summary = getFormSummary(horse);

      expect(summary.label).toBe('Steady');
    });
  });

  // FIX v2.1: Class-Context Scoring Tests
  describe('Class Context Scoring', () => {
    // Today's race context: Allowance race with $75k purse
    const todayAllowanceContext: ClassContext = {
      classification: 'allowance',
      claimingPrice: null,
      purse: 75000,
    };

    // Today's race context: Claiming race $25k
    const todayClaimingContext: ClassContext = {
      classification: 'claiming',
      claimingPrice: 25000,
      purse: 40000,
    };

    describe('wins at higher class', () => {
      // v3.2: Win max reduced from 18 to 15 pts
      it('scores maximum (15) for win at G1 stakes when dropping to allowance', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 1,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
            }),
          ],
        });

        const result = calculateFormScore(horse, todayAllowanceContext);

        // v3.2: Max is now 15 (was 18)
        expect(result.recentFormScore).toBe(15);
        expect(result.classAdjustmentApplied).toBe(false); // Wins don't get "adjusted", they're already max
      });

      it('scores maximum (15) for win at allowance when dropping to claiming', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 1,
              classification: 'allowance',
              claimingPrice: null,
              purse: 75000,
            }),
          ],
        });

        const result = calculateFormScore(horse, todayClaimingContext);

        expect(result.recentFormScore).toBe(15);
      });
    });

    describe('4th-6th place at higher class gets neutral boost', () => {
      // v3.2: Neutral boost range changed from 11-13 to 9-11
      it('boosts 5th place at G1 to neutral (9-11 pts) when dropping to allowance', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 10,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
            }),
          ],
        });

        // Without class context
        const noContextResult = calculateFormScore(horse);
        // With class context (dropping from G1 to allowance)
        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        // Without context: 5th with 10L behind = 5 points (v3.2: was 7)
        expect(noContextResult.recentFormScore).toBe(5);

        // With context: should be boosted to neutral (9-11)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(9);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(11);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
        expect(withContextResult.reasoning).toContain('Class drop');
      });

      it('boosts 4th place at stakes to neutral when dropping to claiming', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 4,
              lengthsBehind: 8,
              classification: 'stakes',
              claimingPrice: null,
              purse: 200000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayClaimingContext);

        // v3.2: Neutral is 9-11 (was 11+)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(9);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });
    });

    describe('7th+ at higher class gets neutral boost', () => {
      // v3.2: Neutral boost range changed from 9-11 to 7-9
      it('boosts 8th place at G2 to neutral (7-9 pts) when dropping to allowance', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 8,
              lengthsBehind: 15,
              classification: 'stakes-graded-2',
              claimingPrice: null,
              purse: 500000,
            }),
          ],
        });

        // Without class context
        const noContextResult = calculateFormScore(horse);
        // With class context (dropping from G2 to allowance)
        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        // Without context: 8th place = 4 points (v3.2: unchanged)
        expect(noContextResult.recentFormScore).toBe(4);

        // With context: should be boosted to neutral (7-9)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(7);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(9);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });

      it('boosts 10th place at G1 to neutral when dropping to claiming', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 10,
              lengthsBehind: 20,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayClaimingContext);

        // v3.2: Neutral is 7-9 (was 9+)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(7);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });
    });

    describe('2nd/3rd place at higher class gets bonus', () => {
      // v3.2: Near-win level is now capped at 14 (was 16)
      it('boosts 2nd place at G1 to near-win level when dropping', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 2,
              lengthsBehind: 3.0,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
            }),
          ],
        });

        // Without context: 2nd more than 2L behind = 9 points (v3.2: was 11)
        const noContextResult = calculateFormScore(horse);
        // With context: should get bonus
        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        expect(noContextResult.recentFormScore).toBe(9);
        expect(withContextResult.recentFormScore).toBeGreaterThan(9);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(14);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });

      it('boosts 3rd place at stakes to near-win level when dropping', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 3,
              lengthsBehind: 4.0,
              classification: 'stakes',
              claimingPrice: null,
              purse: 200000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayClaimingContext);

        // v3.2: Base is 9 (was 10), boosted should be > 9
        expect(withContextResult.recentFormScore).toBeGreaterThan(9);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });
    });

    describe('same class scoring unchanged', () => {
      it('does not adjust 5th place at allowance when racing at allowance', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 10,
              classification: 'allowance',
              claimingPrice: null,
              purse: 75000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        // Same class = no adjustment, v3.2: 5th = 5 pts (was 7)
        expect(withContextResult.recentFormScore).toBe(5);
        expect(withContextResult.classAdjustmentApplied).toBe(false);
      });

      it('does not adjust 8th place at claiming when racing at claiming', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 8,
              lengthsBehind: 15,
              classification: 'claiming',
              claimingPrice: 25000,
              purse: 40000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayClaimingContext);

        // v3.2: 8th = 4 pts (unchanged)
        expect(withContextResult.recentFormScore).toBe(4);
        expect(withContextResult.classAdjustmentApplied).toBe(false);
      });
    });

    describe('lower class past race', () => {
      it('does not adjust or penalize losses at lower class', () => {
        // Horse raced at claiming, now stepping up to allowance
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 10,
              classification: 'claiming',
              claimingPrice: 25000,
              purse: 40000,
            }),
          ],
        });

        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        // Racing up in class, no bonus for loss at lower level
        // v3.2: 5th = 5 pts (was 7)
        expect(withContextResult.recentFormScore).toBe(5);
        expect(withContextResult.classAdjustmentApplied).toBe(false);
      });
    });

    describe('multiple races with class context', () => {
      it('applies class context to all 3 recent races', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            // Race 1: 5th at G1 (50% weight)
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 10,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
              daysSinceLast: 21,
            }),
            // Race 2: 4th at G2 (30% weight)
            createPastPerformance({
              finishPosition: 4,
              lengthsBehind: 8,
              classification: 'stakes-graded-2',
              claimingPrice: null,
              purse: 500000,
              daysSinceLast: 28,
            }),
            // Race 3: 7th at G3 (20% weight)
            createPastPerformance({
              finishPosition: 7,
              lengthsBehind: 12,
              classification: 'stakes-graded-3',
              claimingPrice: null,
              purse: 300000,
              daysSinceLast: 35,
            }),
          ],
        });

        // Without context: would score poorly
        const noContextResult = calculateFormScore(horse);
        // With context: dropping to allowance, all higher class losses boosted
        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        expect(withContextResult.recentFormScore).toBeGreaterThan(noContextResult.recentFormScore);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
        expect(withContextResult.classAdjustments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('reasoning includes class adjustments', () => {
      it('shows class drop info in reasoning', () => {
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 6,
              lengthsBehind: 12,
              classification: 'stakes-graded-1',
              claimingPrice: null,
              purse: 1000000,
            }),
          ],
        });

        const result = calculateFormScore(horse, todayAllowanceContext);

        expect(result.reasoning).toContain('Class drop');
        expect(result.classAdjustments.length).toBeGreaterThan(0);
      });
    });

    describe('claiming price tier comparison', () => {
      it('boosts losses when dropping from high claiming to low claiming', () => {
        // Horse raced at $75k claiming (level 3.8), now dropping to $10k claiming (level 3.0)
        // Difference of 0.8 exceeds the 0.5 "same class" threshold
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 8,
              classification: 'claiming',
              claimingPrice: 75000, // High claiming tier (level 3.8)
              purse: 80000,
            }),
          ],
        });

        const lowerClaimingContext: ClassContext = {
          classification: 'claiming',
          claimingPrice: 10000, // Low claiming tier (level 3.0)
          purse: 25000,
        };

        const result = calculateFormScore(horse, lowerClaimingContext);

        // Should get boost for dropping within claiming - significant tier drop
        // v3.2: Neutral is 9-11 (was 11+)
        expect(result.recentFormScore).toBeGreaterThanOrEqual(9);
        expect(result.classAdjustmentApplied).toBe(true);
      });

      it('does not boost when claiming tiers are similar ($50k to $25k)', () => {
        // $50k claiming (3.8) vs $25k claiming (3.5) = 0.3 difference, within 0.5 threshold
        const horse = createHorseEntry({
          daysSinceLastRace: 21,
          pastPerformances: [
            createPastPerformance({
              finishPosition: 5,
              lengthsBehind: 8,
              classification: 'claiming',
              claimingPrice: 50000,
              purse: 60000,
            }),
          ],
        });

        const similarClaimingContext: ClassContext = {
          classification: 'claiming',
          claimingPrice: 25000,
          purse: 40000,
        };

        const result = calculateFormScore(horse, similarClaimingContext);

        // Similar claiming tiers = no adjustment (difference within threshold)
        expect(result.classAdjustmentApplied).toBe(false);
      });
    });
  });

  // v3.2: Winner bonus tests for Model B (reduced from v3.0)
  describe('Winner Bonus Stacking (v3.2)', () => {
    it('awards +12 pts for won last out only', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 4, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 5, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.recentWinnerBonus).toBe(12);
      expect(result.wonLastOut).toBe(true);
      expect(result.won2OfLast3).toBe(false);
    });

    it('awards +17 pts for won last out AND 2 of 3', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 4, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.recentWinnerBonus).toBe(17); // 12 + 5 = 17
      expect(result.wonLastOut).toBe(true);
      expect(result.won2OfLast3).toBe(true);
    });

    it('awards +5 pts for won 2 of 3 but NOT last out', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 4, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.recentWinnerBonus).toBe(5); // Only won2of3 bonus
      expect(result.wonLastOut).toBe(false);
      expect(result.won2OfLast3).toBe(true);
    });

    it('includes won3of5 stacking bonus', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 4, daysSinceLast: 21 }),
          createPastPerformance({ finishPosition: 5, daysSinceLast: 21 }),
        ],
      });

      const result = calculateFormScore(horse);

      // Won last out (12) + won 2/3 (5) + won 3/5 (3) = 20 pts (max)
      expect(result.recentWinnerBonus).toBe(20);
      expect(result.won3OfLast5).toBe(true);
    });
  });

  describe('Layoff Penalty Cap (v3.2)', () => {
    it('caps layoff penalty at -10 for extended layoff', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 200,
        pastPerformances: [createPastPerformance({ finishPosition: 5, daysSinceLast: 200 })],
      });

      const result = calculateFormScore(horse);

      expect(result.layoffPenalty).toBe(-10);
    });

    it('preserves winner bonus despite layoff penalty', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 120,
        pastPerformances: [createPastPerformance({ finishPosition: 1, daysSinceLast: 120 })],
      });

      const result = calculateFormScore(horse);

      // Winner bonus (+12) should not be wiped out by layoff penalty
      expect(result.recentWinnerBonus).toBe(12);
      expect(result.layoffPenalty).toBe(-10);
      // Total should be positive: recent form + winner bonus - layoff penalty
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Minimum Form Score Floor (v3.2)', () => {
    it('ensures recent winners score at least 5 pts', () => {
      // First-time winner with only 1 PP (40% confidence)
      const horse = createHorseEntry({
        daysSinceLastRace: 180,
        pastPerformances: [createPastPerformance({ finishPosition: 1, daysSinceLast: 180 })],
      });

      const result = calculateFormScore(horse);

      // Even with layoff penalty and confidence multiplier, should be at least 5
      expect(result.wonLastOut).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Win Recency Bonus (v3.2)', () => {
    it('awards +3 pts for win within 30 days', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [createPastPerformance({ finishPosition: 1, daysSinceLast: 21 })],
      });

      const result = calculateFormScore(horse);

      // Won last race which was 21 days ago (within 30 days)
      expect(result.winRecencyBonus).toBe(3);
      expect(result.daysSinceLastWin).toBe(0); // Won most recent race
    });

    it('awards +2 pts for win within 60 days', () => {
      // First PP is non-win with 35 days since last race
      // Second PP is win with 10 days since its previous race
      // Total days since win = 35 + 10 = 45 days
      const horse = createHorseEntry({
        daysSinceLastRace: 35,
        pastPerformances: [
          createPastPerformance({ finishPosition: 3, daysSinceLast: 35 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 10 }), // Won 35+10 = 45 days ago
        ],
      });

      const result = calculateFormScore(horse);

      // daysSinceLastWin = 35 (from first PP) + 10 (to reach the win) = 45 days
      // 45 is between 30 and 60, so should get +2 warm bonus
      expect(result.daysSinceLastWin).toBe(45);
      expect(result.daysSinceLastWin).toBeGreaterThan(30);
      expect(result.daysSinceLastWin).toBeLessThanOrEqual(60);
      expect(result.winRecencyBonus).toBe(2);
    });

    it('awards 0 pts for win over 60 days ago', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 30,
        pastPerformances: [
          createPastPerformance({ finishPosition: 5, daysSinceLast: 30 }),
          createPastPerformance({ finishPosition: 4, daysSinceLast: 30 }),
          createPastPerformance({ finishPosition: 1, daysSinceLast: 30 }), // Won 90 days ago
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.daysSinceLastWin).toBeGreaterThan(60);
      expect(result.winRecencyBonus).toBe(0);
    });
  });
});
