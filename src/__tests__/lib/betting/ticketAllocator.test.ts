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
    scaledWhatToSay: '$2 Win on #1',
    scaledPayout: '$20-$40',
  };
  return { ...defaults, ...overrides };
}

function makePool(): ScaledTopBet[] {
  return [
    // WIN_SHOW group
    makeBet({
      internalType: 'WIN',
      horseNumbers: [1],
      scaledCost: 2,
      expectedValue: 1.5,
      probability: 30,
      riskTier: 'Conservative',
    }),
    makeBet({
      internalType: 'PLACE',
      horseNumbers: [2],
      scaledCost: 2,
      expectedValue: 1.2,
      probability: 45,
      riskTier: 'Conservative',
    }),
    makeBet({
      internalType: 'SHOW',
      horseNumbers: [3],
      scaledCost: 2,
      expectedValue: 1.0,
      probability: 55,
      riskTier: 'Conservative',
    }),
    // EXACTA group
    makeBet({
      internalType: 'EXACTA_STRAIGHT',
      horseNumbers: [1, 2],
      scaledCost: 4,
      expectedValue: 2.0,
      probability: 10,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'EXACTA_BOX_2',
      horseNumbers: [1, 2],
      scaledCost: 8,
      expectedValue: 1.8,
      probability: 20,
      riskTier: 'Conservative',
    }),
    // TRIFECTA group
    makeBet({
      internalType: 'TRIFECTA_STRAIGHT',
      horseNumbers: [1, 2, 3],
      scaledCost: 6,
      expectedValue: 3.0,
      probability: 5,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'TRIFECTA_BOX_3',
      horseNumbers: [1, 2, 3],
      scaledCost: 12,
      expectedValue: 2.5,
      probability: 15,
      riskTier: 'Conservative',
    }),
    // SUPERFECTA group
    makeBet({
      internalType: 'SUPERFECTA_STRAIGHT',
      horseNumbers: [1, 2, 3, 4],
      scaledCost: 4,
      expectedValue: 4.0,
      probability: 1,
      riskTier: 'Aggressive',
    }),
    // Wheel bets (should be excluded)
    makeBet({
      internalType: 'EXACTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 10,
      expectedValue: 5.0,
      probability: 25,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'TRIFECTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 20,
      expectedValue: 6.0,
      probability: 8,
      riskTier: 'Moderate',
    }),
    makeBet({
      internalType: 'SUPERFECTA_WHEEL',
      horseNumbers: [1],
      scaledCost: 30,
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
    it('returns exactly betCount bets when pool is large enough', () => {
      const result = allocateTicket(makeInput({ betCount: 3 }));
      expect(result.selectedBets.length).toBe(3);
    });

    it('returns fewer bets when pool is smaller than betCount', () => {
      const smallPool = [
        makeBet({ internalType: 'WIN', horseNumbers: [1], scaledCost: 2, expectedValue: 1.5 }),
      ];
      const result = allocateTicket(makeInput({ betPool: smallPool, betCount: 3 }));
      expect(result.selectedBets.length).toBeLessThanOrEqual(1);
    });

    it('never returns wheel bets', () => {
      const result = allocateTicket(makeInput({ betCount: 5 }));
      const wheelTypes: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];
      for (const bet of result.selectedBets) {
        expect(wheelTypes).not.toContain(bet.internalType);
      }
    });

    it('never returns two bets from the same column', () => {
      const result = allocateTicket(makeInput({ betCount: 5 }));
      const groups = result.selectedBets.map((b) => {
        if (['WIN', 'PLACE', 'SHOW'].includes(b.internalType)) return 'WIN_SHOW';
        if (b.internalType.startsWith('EXACTA') || b.internalType === 'QUINELLA') return 'EXACTA';
        if (b.internalType.startsWith('TRIFECTA')) return 'TRIFECTA';
        return 'SUPERFECTA';
      });
      const unique = new Set(groups);
      expect(unique.size).toBe(groups.length);
    });

    it('total cost never exceeds budget × 1.1', () => {
      const result = allocateTicket(makeInput({ budget: 20, betCount: 5 }));
      expect(result.totalCost).toBeLessThanOrEqual(20 * 1.1);
      expect(result.withinBudget).toBe(true);
    });

    it('Conservative mode never returns Aggressive or Moderate riskTier bets', () => {
      const result = allocateTicket(makeInput({ mode: 'Conservative', betCount: 5 }));
      for (const bet of result.selectedBets) {
        expect(bet.riskTier).toBe('Conservative');
      }
    });

    it('Moderate mode never returns Aggressive riskTier bets', () => {
      const result = allocateTicket(makeInput({ mode: 'Moderate', betCount: 5 }));
      for (const bet of result.selectedBets) {
        expect(['Conservative', 'Moderate']).toContain(bet.riskTier);
      }
    });

    it('does not return duplicate horse combinations within same column', () => {
      // Create pool with duplicates in same column
      const pool = [
        makeBet({
          internalType: 'EXACTA_STRAIGHT',
          horseNumbers: [1, 2],
          scaledCost: 4,
          expectedValue: 2.0,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'EXACTA_BOX_2',
          horseNumbers: [1, 2],
          scaledCost: 8,
          expectedValue: 1.5,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 2,
          expectedValue: 1.0,
          riskTier: 'Conservative',
        }),
      ];
      const result = allocateTicket(makeInput({ betPool: pool, betCount: 3 }));
      // Should only pick one from EXACTA group (the one with higher EV after dedup)
      const exactaBets = result.selectedBets.filter((b) => b.internalType.startsWith('EXACTA'));
      expect(exactaBets.length).toBeLessThanOrEqual(1);
    });

    it('returns empty selectedBets for empty pool gracefully', () => {
      const result = allocateTicket(makeInput({ betPool: [] }));
      expect(result.selectedBets).toEqual([]);
      expect(result.totalCost).toBe(0);
      expect(result.blendedConfidence).toBe(0);
    });

    it('blendedConfidence is correctly weighted by cost', () => {
      const pool = [
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 10,
          probability: 40,
          expectedValue: 2.0,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'EXACTA_STRAIGHT',
          horseNumbers: [1, 2],
          scaledCost: 10,
          probability: 20,
          expectedValue: 1.5,
          riskTier: 'Conservative',
        }),
      ];
      const result = allocateTicket(makeInput({ betPool: pool, betCount: 2, budget: 100 }));

      if (result.selectedBets.length === 2) {
        // Both bets cost $10, so blended = (40*10 + 20*10) / (10+10) = 30
        expect(result.blendedConfidence).toBe(30);
      }
    });
  });

  describe('generateSurpriseTicket', () => {
    it('never returns bets with probability < 2', () => {
      // Include a very low probability bet
      const pool = [
        makeBet({
          internalType: 'WIN',
          horseNumbers: [1],
          scaledCost: 2,
          probability: 0.5,
          expectedValue: 5.0,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'EXACTA_STRAIGHT',
          horseNumbers: [1, 2],
          scaledCost: 4,
          probability: 10,
          expectedValue: 2.0,
          riskTier: 'Conservative',
        }),
        makeBet({
          internalType: 'TRIFECTA_STRAIGHT',
          horseNumbers: [1, 2, 3],
          scaledCost: 6,
          probability: 5,
          expectedValue: 3.0,
          riskTier: 'Conservative',
        }),
      ];
      const result = generateSurpriseTicket(makeInput({ betPool: pool, betCount: 3 }));
      for (const bet of result.selectedBets) {
        expect(bet.probability).toBeGreaterThanOrEqual(2);
      }
    });

    it('never returns wheel bets', () => {
      const result = generateSurpriseTicket(makeInput({ betCount: 5 }));
      const wheelTypes: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];
      for (const bet of result.selectedBets) {
        expect(wheelTypes).not.toContain(bet.internalType);
      }
    });

    it('respects budget constraint', () => {
      const result = generateSurpriseTicket(makeInput({ budget: 20, betCount: 5 }));
      expect(result.totalCost).toBeLessThanOrEqual(20 * 1.1);
    });
  });
});
