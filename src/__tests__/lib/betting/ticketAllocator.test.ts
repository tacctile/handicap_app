/**
 * Tests for Ticket Allocator engine
 */

import { describe, it, expect } from 'vitest';
import {
  allocateTicket,
  generateSurpriseTicket,
  type TicketAllocatorInput,
} from '../../../lib/betting/ticketAllocator';
import type { ScaledTopBet } from '../../../components/TopBets/TopBetsView';
import type { RiskTier, TopBetType } from '../../../lib/betting/topBetsGenerator';

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeBet(overrides: Partial<ScaledTopBet> & { internalType: TopBetType }): ScaledTopBet {
  const defaults: ScaledTopBet = {
    rank: 1,
    riskTier: 'Conservative' as RiskTier,
    betType: 'Win',
    internalType: 'WIN',
    horses: [{ programNumber: 1, name: 'Test Horse' }],
    cost: 2,
    whatToSay: '$1 Win on #1',
    whatThisBetIs: 'Win bet',
    whyThisBet: 'High probability',
    estimatedPayout: '$10-$20',
    probability: 30,
    expectedValue: 1.5,
    combinationsInvolved: 1,
    horseNumbers: [1],
    scaledCost: 2,
    scaledWhatToSay: '$1 Win on #1',
    scaledPayout: '$20-$40',
  };
  return { ...defaults, ...overrides };
}

function makePool(): ScaledTopBet[] {
  return [
    // WIN group
    makeBet({
      internalType: 'WIN',
      horseNumbers: [1],
      scaledCost: 2,
      cost: 2,
      expectedValue: 1.5,
      probability: 30,
      riskTier: 'Conservative',
    }),
    // PLACE group
    makeBet({
      internalType: 'PLACE',
      horseNumbers: [2],
      scaledCost: 2,
      cost: 2,
      expectedValue: 1.2,
      probability: 45,
      riskTier: 'Conservative',
    }),
    // SHOW group
    makeBet({
      internalType: 'SHOW',
      horseNumbers: [3],
      scaledCost: 2,
      cost: 2,
      expectedValue: 1.0,
      probability: 55,
      riskTier: 'Conservative',
    }),
    // EXACTA group
    makeBet({
      internalType: 'EXACTA_STRAIGHT',
      horseNumbers: [1, 2],
      scaledCost: 4,
      cost: 4,
      expectedValue: 2.0,
      probability: 10,
      riskTier: 'Moderate',
      combinationsInvolved: 1,
    }),
    makeBet({
      internalType: 'EXACTA_BOX_2',
      horseNumbers: [1, 2],
      scaledCost: 8,
      cost: 8,
      expectedValue: 1.8,
      probability: 20,
      riskTier: 'Conservative',
      combinationsInvolved: 2,
    }),
    // TRIFECTA group
    makeBet({
      internalType: 'TRIFECTA_STRAIGHT',
      horseNumbers: [1, 2, 3],
      scaledCost: 6,
      cost: 6,
      expectedValue: 3.0,
      probability: 5,
      riskTier: 'Moderate',
      combinationsInvolved: 1,
    }),
    makeBet({
      internalType: 'TRIFECTA_BOX_3',
      horseNumbers: [1, 2, 3],
      scaledCost: 12,
      cost: 12,
      expectedValue: 2.5,
      probability: 15,
      riskTier: 'Conservative',
      combinationsInvolved: 6,
    }),
    // SUPERFECTA group
    makeBet({
      internalType: 'SUPERFECTA_STRAIGHT',
      horseNumbers: [1, 2, 3, 4],
      scaledCost: 4,
      cost: 4,
      expectedValue: 4.0,
      probability: 1,
      riskTier: 'Aggressive',
      combinationsInvolved: 1,
    }),
    // Wheel bets (should be excluded)
    makeBet({
      internalType: 'EXACTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 10,
      cost: 10,
      expectedValue: 5.0,
      probability: 25,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'TRIFECTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 20,
      cost: 20,
      expectedValue: 6.0,
      probability: 8,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'SUPERFECTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 30,
      cost: 30,
      expectedValue: 7.0,
      probability: 3,
      riskTier: 'Aggressive',
    }),
  ];
}

function makeInput(overrides?: Partial<TicketAllocatorInput>): TicketAllocatorInput {
  return {
    betPool: makePool(),
    budget: 50,
    betCount: 3,
    mode: 'Aggressive',
    surpriseMode: false,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ticketAllocator', () => {
  describe('allocateTicket', () => {
    it('returns bets array with AllocatedBet fields', () => {
      const result = allocateTicket(makeInput({ betCount: 3 }));
      expect(result.bets.length).toBeGreaterThan(0);
      const bet = result.bets[0]!;
      expect(bet.computedBase).toBeGreaterThanOrEqual(1);
      expect(bet.computedCost).toBeGreaterThan(0);
      expect(typeof bet.scaledScript).toBe('string');
      expect(typeof bet.isOverBudget).toBe('boolean');
      expect(typeof bet.overBudgetAmount).toBe('number');
    });

    it('returns exactly betCount bets when pool is large enough', () => {
      const result = allocateTicket(makeInput({ betCount: 3 }));
      expect(result.bets.length).toBe(3);
      expect(result.shortfall).toBe(0);
    });

    it('returns fewer bets with shortfall when pool is small', () => {
      const smallPool = [
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 2,
          cost: 2,
          expectedValue: 1.5,
        }),
      ];
      const result = allocateTicket(makeInput({ betPool: smallPool, betCount: 3 }));
      expect(result.bets.length).toBeLessThanOrEqual(1);
      expect(result.shortfall).toBeGreaterThan(0);
    });

    it('never returns wheel bets', () => {
      const result = allocateTicket(makeInput({ betCount: 5 }));
      const wheelTypes: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];
      for (const bet of result.bets) {
        expect(wheelTypes).not.toContain(bet.internalType);
      }
    });

    it('never returns two bets from the same column group', () => {
      const result = allocateTicket(makeInput({ betCount: 5 }));
      const groups = result.bets.map((b) => {
        if (b.internalType === 'WIN') return 'WIN';
        if (b.internalType === 'PLACE') return 'PLACE';
        if (b.internalType === 'SHOW') return 'SHOW';
        if (b.internalType.startsWith('EXACTA') || b.internalType === 'QUINELLA') return 'EXACTA';
        if (b.internalType.startsWith('TRIFECTA')) return 'TRIFECTA';
        return 'SUPERFECTA';
      });
      const unique = new Set(groups);
      expect(unique.size).toBe(groups.length);
    });

    it('budget distribution scales base amounts to fill budget', () => {
      const result = allocateTicket(makeInput({ budget: 50, betCount: 3 }));
      // With budget distribution, total cost should be much closer to budget than raw $1 base
      expect(result.totalCost).toBeGreaterThan(10);
      expect(result.budgetUtilization).toBeGreaterThan(20);
    });

    it('Conservative mode never returns Aggressive or Moderate riskTier bets', () => {
      const result = allocateTicket(makeInput({ mode: 'Conservative', betCount: 5 }));
      for (const bet of result.bets) {
        expect(bet.riskTier).toBe('Conservative');
      }
    });

    it('Moderate mode never returns Aggressive riskTier bets', () => {
      const result = allocateTicket(makeInput({ mode: 'Moderate', betCount: 5 }));
      for (const bet of result.bets) {
        expect(['Conservative', 'Moderate']).toContain(bet.riskTier);
      }
    });

    it('does not return duplicate horse combinations within same column', () => {
      const pool = [
        makeBet({
          internalType: 'EXACTA_STRAIGHT',
          horseNumbers: [1, 2],
          scaledCost: 4,
          cost: 4,
          expectedValue: 2.0,
          riskTier: 'Conservative',
          combinationsInvolved: 1,
        }),
        makeBet({
          internalType: 'EXACTA_BOX_2',
          horseNumbers: [1, 2],
          scaledCost: 8,
          cost: 8,
          expectedValue: 1.5,
          riskTier: 'Conservative',
          combinationsInvolved: 2,
        }),
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 2,
          cost: 2,
          expectedValue: 1.0,
          riskTier: 'Conservative',
        }),
      ];
      const result = allocateTicket(makeInput({ betPool: pool, betCount: 3 }));
      const exactaBets = result.bets.filter((b) => b.internalType.startsWith('EXACTA'));
      expect(exactaBets.length).toBeLessThanOrEqual(1);
    });

    it('returns empty bets for empty pool gracefully', () => {
      const result = allocateTicket(makeInput({ betPool: [] }));
      expect(result.bets).toEqual([]);
      expect(result.totalCost).toBe(0);
      expect(result.blendedConfidence).toBe(0);
    });

    it('includes availability for bet counts 1-5', () => {
      const result = allocateTicket(makeInput());
      for (let n = 1; n <= 5; n++) {
        expect(result.availability[n]).toBeDefined();
        expect(typeof result.availability[n]!.available).toBe('boolean');
      }
    });

    it('includes utilizationStatus', () => {
      const result = allocateTicket(makeInput());
      expect(['excellent', 'good', 'low', 'critical']).toContain(result.utilizationStatus);
    });

    it('includes integrity verification', () => {
      const result = allocateTicket(makeInput());
      expect(typeof result.integrity.verified).toBe('boolean');
      expect(typeof result.integrity.issueCount).toBe('number');
    });

    it('selectedBets alias matches bets for backward compat', () => {
      const result = allocateTicket(makeInput());
      expect(result.selectedBets).toBe(result.bets);
    });

    it('WIN, PLACE, SHOW are separate column groups', () => {
      // With 3 bets in Aggressive mode with full pool, we should be able to get WIN + PLACE + SHOW
      const pool = [
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          cost: 2,
          scaledCost: 2,
          expectedValue: 1.5,
          probability: 30,
        }),
        makeBet({
          internalType: 'PLACE',
          horseNumbers: [2],
          cost: 2,
          scaledCost: 2,
          expectedValue: 1.2,
          probability: 45,
        }),
        makeBet({
          internalType: 'SHOW',
          horseNumbers: [3],
          cost: 2,
          scaledCost: 2,
          expectedValue: 1.0,
          probability: 55,
        }),
      ];
      const result = allocateTicket(makeInput({ betPool: pool, betCount: 3 }));
      const types = result.bets.map((b) => b.internalType);
      // Should have all 3 since they are separate groups
      expect(types).toContain('WIN');
      expect(types).toContain('PLACE');
      expect(types).toContain('SHOW');
    });
  });

  describe('generateSurpriseTicket', () => {
    it('never returns bets with probability < 5', () => {
      const pool = [
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 2,
          cost: 2,
          probability: 0.5,
          expectedValue: 5.0,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'EXACTA_STRAIGHT',
          horseNumbers: [1, 2],
          scaledCost: 4,
          cost: 4,
          probability: 10,
          expectedValue: 2.0,
          riskTier: 'Conservative',
          combinationsInvolved: 1,
        }),
        makeBet({
          internalType: 'TRIFECTA_STRAIGHT',
          horseNumbers: [1, 2, 3],
          scaledCost: 6,
          cost: 6,
          probability: 8,
          expectedValue: 3.0,
          riskTier: 'Conservative',
          combinationsInvolved: 1,
        }),
      ];
      const result = generateSurpriseTicket(makeInput({ betPool: pool, betCount: 3 }));
      for (const bet of result.bets) {
        expect(bet.probability).toBeGreaterThanOrEqual(5);
      }
    });

    it('never returns wheel bets', () => {
      const result = generateSurpriseTicket(makeInput({ betCount: 5 }));
      const wheelTypes: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];
      for (const bet of result.bets) {
        expect(wheelTypes).not.toContain(bet.internalType);
      }
    });

    it('runs budget distribution on surprise bets', () => {
      const result = generateSurpriseTicket(makeInput({ budget: 50, betCount: 3 }));
      if (result.bets.length > 0) {
        const bet = result.bets[0]!;
        expect(bet.computedBase).toBeGreaterThanOrEqual(1);
        expect(bet.computedCost).toBeGreaterThan(0);
      }
    });
  });
});
