/**
 * Multi-Race Optimizer Tests
 *
 * Tests for ticket optimization and race analysis:
 * - Race strength classification
 * - Probability calculations
 * - Strategy-based selection
 * - Budget optimization
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRaceStrength,
  findStandoutHorse,
  getTopHorsesForRace,
  calculateTicketProbability,
  calculateExpectedValue,
  generateOptimalSelections,
  optimizeMultiRaceBet,
  getAvailableMultiRaceBets,
  analyzeRaceCard,
} from '../multiraceOptimizer';
import type { MultiRaceRaceData, MultiRaceHorse, RaceSelection } from '../multiraceTypes';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createHorse(programNumber: number, score: number, odds: number = 5): MultiRaceHorse {
  return {
    programNumber,
    horseName: `Horse ${programNumber}`,
    score,
    morningLineOdds: `${odds}-1`,
    decimalOdds: odds,
    winProbability: 1 / (odds + 1),
    tier: score >= 180 ? 1 : score >= 160 ? 2 : 3,
    isSingleCandidate: false,
    scoreGapToNext: 0,
  };
}

function createRace(raceNumber: number, horses: MultiRaceHorse[]): MultiRaceRaceData {
  const strength = classifyRaceStrength(horses);
  const standout = findStandoutHorse(horses);

  return {
    raceNumber,
    postTime: '12:00 PM',
    fieldSize: horses.length,
    horses,
    strength,
    hasStandout: !!standout,
    standoutHorse: standout,
    isCancelled: false,
  };
}

// ============================================================================
// RACE STRENGTH CLASSIFICATION
// ============================================================================

describe('Race Strength Classification', () => {
  describe('classifyRaceStrength', () => {
    it('should classify standout race correctly', () => {
      const horses = [
        createHorse(1, 195), // Clear standout
        createHorse(2, 165),
        createHorse(3, 155),
        createHorse(4, 140),
      ];

      expect(classifyRaceStrength(horses)).toBe('standout');
    });

    it('should classify competitive race correctly', () => {
      const horses = [
        createHorse(1, 175),
        createHorse(2, 172),
        createHorse(3, 168),
        createHorse(4, 162),
        createHorse(5, 145),
      ];

      expect(classifyRaceStrength(horses)).toBe('competitive');
    });

    it('should classify weak race correctly', () => {
      const horses = [
        createHorse(1, 158),
        createHorse(2, 152),
        createHorse(3, 148),
        createHorse(4, 140),
      ];

      expect(classifyRaceStrength(horses)).toBe('weak');
    });

    it('should handle empty horse array', () => {
      expect(classifyRaceStrength([])).toBe('weak');
    });

    it('should require sufficient gap for standout', () => {
      const horses = [
        createHorse(1, 185),
        createHorse(2, 180), // Only 5 pts gap - not standout
        createHorse(3, 160),
      ];

      expect(classifyRaceStrength(horses)).not.toBe('standout');
    });
  });

  describe('findStandoutHorse', () => {
    it('should find clear standout', () => {
      const horses = [createHorse(1, 195), createHorse(2, 165), createHorse(3, 155)];

      const standout = findStandoutHorse(horses);
      expect(standout).not.toBeUndefined();
      expect(standout?.programNumber).toBe(1);
      expect(standout?.score).toBe(195);
    });

    it('should return undefined when no standout', () => {
      const horses = [createHorse(1, 175), createHorse(2, 172), createHorse(3, 168)];

      expect(findStandoutHorse(horses)).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      expect(findStandoutHorse([])).toBeUndefined();
    });
  });
});

// ============================================================================
// SELECTION STRATEGIES
// ============================================================================

describe('Selection Strategies', () => {
  describe('getTopHorsesForRace', () => {
    const standoutRace = createRace(1, [
      createHorse(3, 195),
      createHorse(1, 165),
      createHorse(2, 155),
      createHorse(4, 140),
    ]);

    const competitiveRace = createRace(2, [
      createHorse(1, 175),
      createHorse(2, 172),
      createHorse(3, 168),
      createHorse(4, 162),
    ]);

    const weakRace = createRace(3, [
      createHorse(1, 158),
      createHorse(2, 152),
      createHorse(3, 148),
      createHorse(4, 140),
    ]);

    it('should use single for standout in conservative strategy', () => {
      const horses = getTopHorsesForRace(standoutRace, 'conservative');
      expect(horses.length).toBe(1);
      expect(horses).toContain(3); // Standout horse
    });

    it('should spread in competitive race for balanced strategy', () => {
      const horses = getTopHorsesForRace(competitiveRace, 'balanced');
      expect(horses.length).toBeGreaterThanOrEqual(2);
      expect(horses.length).toBeLessThanOrEqual(3);
    });

    it('should use ALL in weak race for aggressive strategy', () => {
      const horses = getTopHorsesForRace(weakRace, 'aggressive');
      expect(horses.length).toBe(weakRace.fieldSize);
    });

    it('should still single standouts in aggressive strategy', () => {
      const horses = getTopHorsesForRace(standoutRace, 'aggressive');
      expect(horses.length).toBe(1);
    });
  });
});

// ============================================================================
// PROBABILITY CALCULATIONS
// ============================================================================

describe('Probability Calculations', () => {
  describe('calculateTicketProbability', () => {
    it('should calculate probability for simple ticket', () => {
      const races = [
        createRace(1, [createHorse(1, 180, 3), createHorse(2, 160, 5)]),
        createRace(2, [createHorse(1, 175, 4), createHorse(2, 155, 8)]),
      ];

      const selections: RaceSelection[] = [
        {
          raceNumber: 1,
          legNumber: 1,
          selections: [1],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'standout',
        },
        {
          raceNumber: 2,
          legNumber: 2,
          selections: [1],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'competitive',
        },
      ];

      const prob = calculateTicketProbability(races, selections);
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThan(1);
    });

    it('should increase probability with more selections', () => {
      const races = [
        createRace(1, [createHorse(1, 180, 3), createHorse(2, 170, 5), createHorse(3, 160, 8)]),
        createRace(2, [createHorse(1, 175, 4)]),
      ];

      const singleSelection: RaceSelection[] = [
        {
          raceNumber: 1,
          legNumber: 1,
          selections: [1],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'competitive',
        },
        {
          raceNumber: 2,
          legNumber: 2,
          selections: [1],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'competitive',
        },
      ];

      const multiSelection: RaceSelection[] = [
        {
          raceNumber: 1,
          legNumber: 1,
          selections: [1, 2, 3],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'competitive',
        },
        {
          raceNumber: 2,
          legNumber: 2,
          selections: [1],
          isAllSelected: false,
          fieldSize: 8,
          raceStrength: 'competitive',
        },
      ];

      const probSingle = calculateTicketProbability(races, singleSelection);
      const probMulti = calculateTicketProbability(races, multiSelection);

      expect(probMulti).toBeGreaterThan(probSingle);
    });

    it('should return 0 for empty selections', () => {
      const prob = calculateTicketProbability([], []);
      expect(prob).toBe(0);
    });
  });

  describe('calculateExpectedValue', () => {
    it('should calculate positive EV correctly', () => {
      // 10% chance of $200 payout on $10 cost
      // EV = 0.10 × 200 - 10 = 20 - 10 = +10
      const ev = calculateExpectedValue(0.1, 200, 10);
      expect(ev).toBe(10);
    });

    it('should calculate negative EV correctly', () => {
      // 5% chance of $100 payout on $10 cost
      // EV = 0.05 × 100 - 10 = 5 - 10 = -5
      const ev = calculateExpectedValue(0.05, 100, 10);
      expect(ev).toBe(-5);
    });

    it('should return break-even as 0', () => {
      // 10% chance of $100 payout on $10 cost
      const ev = calculateExpectedValue(0.1, 100, 10);
      expect(ev).toBe(0);
    });
  });
});

// ============================================================================
// TICKET OPTIMIZATION
// ============================================================================

describe('Ticket Optimization', () => {
  describe('generateOptimalSelections', () => {
    const races = [
      createRace(1, [createHorse(3, 195), createHorse(1, 165), createHorse(2, 155)]),
      createRace(2, [
        createHorse(1, 175),
        createHorse(2, 172),
        createHorse(3, 168),
        createHorse(4, 162),
      ]),
    ];

    it('should generate selections for conservative strategy', () => {
      const selections = generateOptimalSelections(races, 'conservative', 50, 2);

      expect(selections.length).toBe(2);
      // First race is standout - should single
      const firstSelection = selections[0];
      expect(firstSelection).toBeDefined();
      expect(firstSelection?.selections.length).toBe(1);
      expect(firstSelection?.selections).toContain(3);
    });

    it('should generate selections for balanced strategy', () => {
      const selections = generateOptimalSelections(races, 'balanced', 50, 2);

      expect(selections.length).toBe(2);
      // Competitive race should have 2-3 horses
      const secondSelection = selections[1];
      expect(secondSelection).toBeDefined();
      expect(secondSelection?.selections.length).toBeGreaterThanOrEqual(2);
    });

    it('should include suggestion reasons', () => {
      const selections = generateOptimalSelections(races, 'balanced', 50, 2);

      const firstSelection = selections[0];
      const secondSelection = selections[1];
      expect(firstSelection).toBeDefined();
      expect(secondSelection).toBeDefined();
      expect(firstSelection?.suggestionReason).toContain('Single');
      expect(secondSelection?.suggestionReason).toContain('Spread');
    });
  });

  describe('optimizeMultiRaceBet', () => {
    const races = [
      createRace(1, [createHorse(1, 185), createHorse(2, 160), createHorse(3, 150)]),
      createRace(2, [createHorse(1, 175), createHorse(2, 170), createHorse(3, 165)]),
    ];

    it('should optimize Daily Double successfully', () => {
      const result = optimizeMultiRaceBet({
        betType: 'daily_double',
        races,
        budget: 50,
        strategy: 'balanced',
      });

      expect(result.isValid).toBe(true);
      expect(result.recommended).not.toBeNull();
      expect(result.budgetUsed).toBeLessThanOrEqual(50);
    });

    it('should fail with insufficient races', () => {
      const result = optimizeMultiRaceBet({
        betType: 'pick_4',
        races, // Only 2 races
        budget: 50,
        strategy: 'balanced',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Not enough races');
    });

    it('should provide multiple ticket options', () => {
      // Don't pass strategy to get all three options
      const result = optimizeMultiRaceBet({
        betType: 'daily_double',
        races,
        budget: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.tickets.length).toBeGreaterThan(1);
    });

    it('should sort tickets by EV', () => {
      const result = optimizeMultiRaceBet({
        betType: 'daily_double',
        races,
        budget: 100,
        strategy: 'balanced',
      });

      for (let i = 1; i < result.tickets.length; i++) {
        const prevTicket = result.tickets[i - 1];
        const currentTicket = result.tickets[i];
        if (prevTicket && currentTicket) {
          expect(prevTicket.expectedValue).toBeGreaterThanOrEqual(currentTicket.expectedValue);
        }
      }
    });

    it('should warn about bankroll percentage', () => {
      const result = optimizeMultiRaceBet({
        betType: 'daily_double',
        races,
        budget: 100,
        strategy: 'balanced',
        dailyBankroll: 50, // Ticket will be > 50% of this
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      const firstWarning = result.warnings[0];
      expect(firstWarning).toBeDefined();
      expect(firstWarning).toContain('bankroll');
    });

    it('should handle cancelled races', () => {
      const race0 = races[0];
      const race1 = races[1];
      if (!race0 || !race1) {
        throw new Error('Test setup failed: races not defined');
      }
      const racesWithCancelled = [race0, { ...race1, isCancelled: true }];

      const result = optimizeMultiRaceBet({
        betType: 'daily_double',
        races: racesWithCancelled,
        budget: 50,
        strategy: 'balanced',
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});

// ============================================================================
// RACE CARD ANALYSIS
// ============================================================================

describe('Race Card Analysis', () => {
  describe('getAvailableMultiRaceBets', () => {
    it('should list available bets for 6 races', () => {
      const available = getAvailableMultiRaceBets(6, 1);

      expect(available.length).toBe(5);
      const dailyDouble = available.find((b) => b.betType === 'daily_double');
      const pick6 = available.find((b) => b.betType === 'pick_6');
      expect(dailyDouble?.isAvailable).toBe(true);
      expect(pick6?.isAvailable).toBe(true);
    });

    it('should mark Pick 6 unavailable for 5 races', () => {
      const available = getAvailableMultiRaceBets(5, 1);

      const pick6 = available.find((b) => b.betType === 'pick_6');
      const pick5 = available.find((b) => b.betType === 'pick_5');
      expect(pick6?.isAvailable).toBe(false);
      expect(pick5?.isAvailable).toBe(true);
    });

    it('should handle starting race offset', () => {
      const available = getAvailableMultiRaceBets(8, 5);

      // Only 4 races remaining (5, 6, 7, 8)
      const pick4 = available.find((b) => b.betType === 'pick_4');
      const pick5 = available.find((b) => b.betType === 'pick_5');
      expect(pick4?.isAvailable).toBe(true);
      expect(pick5?.isAvailable).toBe(false);
    });
  });

  describe('analyzeRaceCard', () => {
    it('should categorize races correctly', () => {
      const races = [
        createRace(1, [createHorse(1, 195), createHorse(2, 160)]),
        createRace(2, [createHorse(1, 175), createHorse(2, 172), createHorse(3, 168)]),
        createRace(3, [createHorse(1, 155), createHorse(2, 150)]),
      ];

      const analysis = analyzeRaceCard(races);

      expect(analysis.totalRaces).toBe(3);
      expect(analysis.standoutRaces).toContain(1);
      expect(analysis.competitiveRaces).toContain(2);
      expect(analysis.weakRaces).toContain(3);
    });

    it('should recommend best opportunity', () => {
      const races = [
        createRace(1, [createHorse(1, 195), createHorse(2, 160)]),
        createRace(2, [createHorse(1, 190), createHorse(2, 165)]),
        createRace(3, [createHorse(1, 188), createHorse(2, 162)]),
        createRace(4, [createHorse(1, 185), createHorse(2, 160)]),
        createRace(5, [createHorse(1, 180), createHorse(2, 158)]),
        createRace(6, [createHorse(1, 175), createHorse(2, 155)]),
      ];

      const analysis = analyzeRaceCard(races);

      expect(analysis.bestOpportunity).toBe('pick_6');
      expect(analysis.recommendation).toContain('Pick 6');
    });
  });
});
