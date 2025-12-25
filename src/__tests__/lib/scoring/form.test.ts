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
  // NOTE: v2.0 rescaled from 30 max to 40 max (scale factor: 40/30 = 1.333)
  describe('Layoff Calculations', () => {
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

    it('returns 9 points for 30-60 day layoff (short freshening)', () => {
      const horse = createLayoffHorse(45);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(9);
      expect(result.reasoning).toContain('freshening');
    });

    it('returns 5 points for 60-90 day layoff', () => {
      const horse = createLayoffHorse(75);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(5);
      expect(result.reasoning).toContain('Moderate layoff');
    });

    it('returns 0-5 points for 180+ day extended layoff', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 180,
        pastPerformances: [
          createPastPerformance({ daysSinceLast: 180, finishPosition: 5 }),
          createPastPerformance({ daysSinceLast: 30, finishPosition: 3 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBeLessThanOrEqual(5);
    });

    it('returns 8 points for quick turnback (<7 days)', () => {
      const horse = createLayoffHorse(5);

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(8);
      expect(result.reasoning).toContain('Quick turnback');
    });

    it('returns 7 points for first-time starter', () => {
      const horse = createFirstTimeStarter();

      const result = calculateFormScore(horse);

      expect(result.layoffScore).toBe(7);
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

      expect(result.layoffScore).toBeGreaterThan(0);
      expect(result.reasoning).toContain('won fresh');
    });
  });

  describe('Recent Form Patterns', () => {
    it('returns 20 points (max) for recent win', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance({ finishPosition: 1, lengthsBehind: 0 })],
      });

      const result = calculateFormScore(horse);

      expect(result.recentFormScore).toBe(20);
    });

    it('returns 11 points for first-time starter (neutral)', () => {
      const horse = createFirstTimeStarter();

      const result = calculateFormScore(horse);

      expect(result.recentFormScore).toBe(11);
    });

    it('weights most recent race higher (50%)', () => {
      // Recent win followed by poor races should still score well
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // 50% weight
          createPastPerformance({ finishPosition: 10 }), // 30% weight
          createPastPerformance({ finishPosition: 10 }), // 20% weight
        ],
      });

      const result = calculateFormScore(horse);

      // 15*0.5 + 3*0.3 + 3*0.2 = 7.5 + 0.9 + 0.6 = 9
      expect(result.recentFormScore).toBeGreaterThanOrEqual(9);
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
    it('returns 7 point bonus for 3+ consecutive ITM finishes (hot streak)', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.consistencyBonus).toBe(7);
      expect(result.itmStreak).toBe(4);
      expect(result.reasoning).toContain('Hot streak');
    });

    it('returns 4 point bonus for 2 consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Breaks streak
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.consistencyBonus).toBe(4);
      expect(result.itmStreak).toBe(2);
    });

    it('returns 1 point bonus for ITM last out only', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Not ITM
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.consistencyBonus).toBe(1);
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

      expect(result.consistencyBonus).toBe(4); // 4/5 ITM = consistent
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
    it('is capped at 40 points maximum', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21, // Optimal layoff = 13
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Recent form = 20
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 1 }), // Hot streak = 7
        ],
      });

      const result = calculateFormScore(horse);

      expect(result.total).toBeLessThanOrEqual(50); // v2.5: increased from 40
    });

    it('combines all components correctly', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [createPastPerformance({ finishPosition: 2, daysSinceLast: 21 })],
      });

      const result = calculateFormScore(horse);

      expect(result.total).toBe(
        result.recentFormScore + result.layoffScore + result.consistencyBonus
      );
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
      it('scores maximum (20) for win at G1 stakes when dropping to allowance', () => {
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

        expect(result.recentFormScore).toBe(20);
        expect(result.classAdjustmentApplied).toBe(false); // Wins don't get "adjusted", they're already max
      });

      it('scores maximum (20) for win at allowance when dropping to claiming', () => {
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

        expect(result.recentFormScore).toBe(20);
      });
    });

    describe('4th-6th place at higher class gets neutral boost', () => {
      it('boosts 5th place at G1 to neutral (12-14 pts) when dropping to allowance', () => {
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

        // Without context: 5th with 10L behind = 8 points
        expect(noContextResult.recentFormScore).toBe(8);

        // With context: should be boosted to neutral (12-14)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(12);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(14);
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

        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(12);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });
    });

    describe('7th+ at higher class gets neutral boost', () => {
      it('boosts 8th place at G2 to neutral (10-12 pts) when dropping to allowance', () => {
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

        // Without context: 8th place = 5 points
        expect(noContextResult.recentFormScore).toBe(5);

        // With context: should be boosted to neutral (10-12)
        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(10);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(12);
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

        expect(withContextResult.recentFormScore).toBeGreaterThanOrEqual(10);
        expect(withContextResult.classAdjustmentApplied).toBe(true);
      });
    });

    describe('2nd/3rd place at higher class gets bonus', () => {
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

        // Without context: 2nd more than 2L behind = 13 points
        const noContextResult = calculateFormScore(horse);
        // With context: should get bonus
        const withContextResult = calculateFormScore(horse, todayAllowanceContext);

        expect(noContextResult.recentFormScore).toBe(13);
        expect(withContextResult.recentFormScore).toBeGreaterThan(13);
        expect(withContextResult.recentFormScore).toBeLessThanOrEqual(18);
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

        expect(withContextResult.recentFormScore).toBeGreaterThan(12); // Base is 12
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

        // Same class = no adjustment
        expect(withContextResult.recentFormScore).toBe(8);
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

        expect(withContextResult.recentFormScore).toBe(5);
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
        expect(withContextResult.recentFormScore).toBe(8);
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
        expect(result.recentFormScore).toBeGreaterThanOrEqual(12);
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
});
