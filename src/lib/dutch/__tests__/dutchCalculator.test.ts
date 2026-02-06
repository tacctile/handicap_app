/**
 * Dutch Book Calculator Tests
 *
 * Tests Dutch book calculations, validation, optimization, and display formatting.
 * Target: 85%+ coverage
 */

import { describe, it, expect } from 'vitest';
import {
  // Calculator
  calculateDutchBook,
  calculateDutchForTargetProfit,
  calculateDutchForTargetReturn,
  calculateDutchEdge,
  calculateImpliedProbability,
  parseOddsToDecimal,
  roundToNearest,
  findMaxViableStake,
  type DutchHorse,
} from '../dutchCalculator';
import {
  // Validator
  validateDutchBook,
  validateHorse,
  analyzeEdge,
  classifyEdge,
  canFormProfitableDutch,
} from '../dutchValidator';
import {
  // Optimizer
  findOptimalDutchCombinations,
  hasProfitableDutch,
  getTopDutchOpportunities,
  convertToDutchCandidates,
  filterDutchCandidates,
  type DutchCandidateHorse,
} from '../dutchOptimizer';
import {
  // Display
  generateDutchSummary,
  generateBetInstruction,
  generateDutchExplanation,
  formatCurrency,
  formatCurrencyForWindow,
  formatDutchForCopy,
  formatLiveCalculation,
} from '../dutchDisplay';
import {
  // Settings
  mergeDutchSettings,
  validateDutchSettings,
  getDutchPresetForRisk,
  DEFAULT_DUTCH_SETTINGS,
} from '../dutchSettings';

// ============================================================================
// TEST DATA
// ============================================================================

const createTestHorses = (): DutchHorse[] => [
  { programNumber: 1, horseName: 'Horse A', decimalOdds: 3.0, oddsDisplay: '2-1' },
  { programNumber: 2, horseName: 'Horse B', decimalOdds: 6.0, oddsDisplay: '5-1' },
  { programNumber: 3, horseName: 'Horse C', decimalOdds: 9.0, oddsDisplay: '8-1' },
];

const createExtendedTestHorses = (): DutchHorse[] => [
  ...createTestHorses(),
  { programNumber: 4, horseName: 'Horse D', decimalOdds: 11.0, oddsDisplay: '10-1' },
  { programNumber: 5, horseName: 'Horse E', decimalOdds: 21.0, oddsDisplay: '20-1' },
];

const createCandidateHorses = (): DutchCandidateHorse[] => [
  {
    programNumber: 1,
    horseName: 'Horse A',
    decimalOdds: 3.0,
    oddsDisplay: '2-1',
    tier: 1,
    confidence: 80,
    score: 190,
    estimatedWinProb: 0.35,
    hasOverlay: true,
  },
  {
    programNumber: 2,
    horseName: 'Horse B',
    decimalOdds: 6.0,
    oddsDisplay: '5-1',
    tier: 2,
    confidence: 65,
    score: 170,
    estimatedWinProb: 0.2,
    hasOverlay: true,
  },
  {
    programNumber: 3,
    horseName: 'Horse C',
    decimalOdds: 9.0,
    oddsDisplay: '8-1',
    tier: 2,
    confidence: 55,
    score: 160,
    estimatedWinProb: 0.12,
    hasOverlay: false,
  },
  {
    programNumber: 4,
    horseName: 'Horse D',
    decimalOdds: 15.0,
    oddsDisplay: '14-1',
    tier: 3,
    confidence: 40,
    score: 140,
    estimatedWinProb: 0.07,
    hasOverlay: true,
  },
];

// ============================================================================
// CALCULATOR TESTS
// ============================================================================

describe('Dutch Book Calculator', () => {
  describe('parseOddsToDecimal', () => {
    it('parses fractional odds (2-1)', () => {
      expect(parseOddsToDecimal('2-1')).toBe(3.0);
    });

    it('parses fractional odds (5-1)', () => {
      expect(parseOddsToDecimal('5-1')).toBe(6.0);
    });

    it('parses fractional odds (8-1)', () => {
      expect(parseOddsToDecimal('8-1')).toBe(9.0);
    });

    it('parses fractional odds with fractions (9-2)', () => {
      expect(parseOddsToDecimal('9-2')).toBe(5.5);
    });

    it('parses EVEN odds', () => {
      expect(parseOddsToDecimal('EVEN')).toBe(2.0);
      expect(parseOddsToDecimal('EVN')).toBe(2.0);
    });

    it('parses slash format (5/2)', () => {
      expect(parseOddsToDecimal('5/2')).toBe(3.5);
    });

    it('parses moneyline positive (+300)', () => {
      expect(parseOddsToDecimal('+300')).toBe(4.0);
    });

    it('parses moneyline negative (-150)', () => {
      expect(parseOddsToDecimal('-150')).toBeCloseTo(1.667, 2);
    });

    it('returns default for invalid input', () => {
      expect(parseOddsToDecimal('')).toBe(2.0);
      expect(parseOddsToDecimal('invalid')).toBe(2.0);
    });
  });

  describe('calculateImpliedProbability', () => {
    it('calculates implied probability for 2/1 odds', () => {
      expect(calculateImpliedProbability(3.0)).toBeCloseTo(0.333, 2);
    });

    it('calculates implied probability for 5/1 odds', () => {
      expect(calculateImpliedProbability(6.0)).toBeCloseTo(0.167, 2);
    });

    it('calculates implied probability for 8/1 odds', () => {
      expect(calculateImpliedProbability(9.0)).toBeCloseTo(0.111, 2);
    });

    it('caps at 99% for very low odds', () => {
      expect(calculateImpliedProbability(1.005)).toBe(0.99);
    });
  });

  describe('roundToNearest', () => {
    it('rounds to nearest $0.10', () => {
      expect(roundToNearest(54.77, 0.1)).toBeCloseTo(54.8, 1);
      expect(roundToNearest(27.47, 0.1)).toBeCloseTo(27.5, 1);
      expect(roundToNearest(18.26, 0.1)).toBeCloseTo(18.3, 1);
    });

    it('rounds to nearest $1', () => {
      expect(roundToNearest(54.77, 1)).toBe(55);
      expect(roundToNearest(27.47, 1)).toBe(27);
    });

    it('returns original for zero increment', () => {
      expect(roundToNearest(54.77, 0)).toBe(54.77);
    });
  });

  describe('calculateDutchBook', () => {
    it('calculates correct bet amounts for 3 horses', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      expect(result.isValid).toBe(true);
      expect(result.hasProfitPotential).toBe(true);
      expect(result.horseCount).toBe(3);
      expect(result.bets.length).toBe(3);

      // Sum of bets should approximately equal total stake
      const totalBets = result.bets.reduce((sum, b) => sum + b.betAmountRounded, 0);
      expect(totalBets).toBeCloseTo(100, 0);
    });

    it('calculates positive edge for favorable odds', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      // Sum of implied probs: 1/3 + 1/6 + 1/9 = 0.611
      // Edge = (1 - 0.611) * 100 = 38.9%
      expect(result.edgePercent).toBeGreaterThan(30);
      expect(result.guaranteedProfit).toBeGreaterThan(0);
    });

    it('returns guaranteed return that is same regardless of winner', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      // All returns should be approximately equal
      const returns = result.bets.map((b) => b.returnIfWins);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

      for (const ret of returns) {
        expect(ret).toBeCloseTo(avgReturn, 0);
      }
    });

    it('rejects less than 2 horses', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: [{ programNumber: 1, horseName: 'Horse A', decimalOdds: 3.0, oddsDisplay: '2-1' }],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('rejects stake below minimum', () => {
      const result = calculateDutchBook({
        totalStake: 5,
        horses: createTestHorses(),
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('warns when individual bets are below minimum', () => {
      const result = calculateDutchBook({
        totalStake: 10,
        horses: createTestHorses(),
        minimumBet: 5,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      const firstWarning = result.warnings[0];
      expect(firstWarning).toBeDefined();
      expect(firstWarning).toContain('below');
    });

    it('handles 4-horse Dutch', () => {
      const horses = createExtendedTestHorses().slice(0, 4);
      const result = calculateDutchBook({
        totalStake: 100,
        horses,
      });

      expect(result.isValid).toBe(true);
      expect(result.horseCount).toBe(4);
    });

    it('handles 5-horse Dutch', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createExtendedTestHorses(),
      });

      expect(result.isValid).toBe(true);
      expect(result.horseCount).toBe(5);
      expect(result.warnings.length).toBe(0); // 5 is at the recommended limit
    });

    it('warns for more than recommended horses', () => {
      const horses = [
        ...createExtendedTestHorses(),
        { programNumber: 6, horseName: 'Horse F', decimalOdds: 31.0, oddsDisplay: '30-1' },
      ];
      const result = calculateDutchBook({
        totalStake: 100,
        horses,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Consider using'))).toBe(true);
    });

    it('detects unprofitable book (sum > 100%)', () => {
      const overroundHorses: DutchHorse[] = [
        { programNumber: 1, horseName: 'Horse A', decimalOdds: 1.5, oddsDisplay: '1-2' },
        { programNumber: 2, horseName: 'Horse B', decimalOdds: 1.5, oddsDisplay: '1-2' },
      ];

      const result = calculateDutchBook({
        totalStake: 100,
        horses: overroundHorses,
      });

      expect(result.hasProfitPotential).toBe(false);
      expect(result.edgePercent).toBeLessThan(0);
    });
  });

  describe('calculateDutchForTargetProfit', () => {
    it('calculates stake needed for target profit', () => {
      const result = calculateDutchForTargetProfit(createTestHorses(), 50);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(true);
      expect(result!.guaranteedProfit).toBeGreaterThanOrEqual(50);
    });

    it('returns null for unprofitable book', () => {
      const overroundHorses: DutchHorse[] = [
        { programNumber: 1, horseName: 'Horse A', decimalOdds: 1.5, oddsDisplay: '1-2' },
        { programNumber: 2, horseName: 'Horse B', decimalOdds: 1.5, oddsDisplay: '1-2' },
      ];

      const result = calculateDutchForTargetProfit(overroundHorses, 50);
      expect(result).toBeNull();
    });
  });

  describe('calculateDutchForTargetReturn', () => {
    it('calculates stake needed for target return', () => {
      const result = calculateDutchForTargetReturn(createTestHorses(), 200);

      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(true);
      expect(result!.guaranteedReturn).toBeGreaterThanOrEqual(200);
    });
  });

  describe('calculateDutchEdge', () => {
    it('calculates edge without full calculation', () => {
      const edge = calculateDutchEdge(createTestHorses());

      expect(edge.hasProfitPotential).toBe(true);
      expect(edge.edgePercent).toBeGreaterThan(30);
      expect(edge.horseCount).toBe(3);
    });
  });

  describe('findMaxViableStake', () => {
    it('finds maximum stake for minimum bet requirement', () => {
      const maxStake = findMaxViableStake(createTestHorses(), 100, 5);

      expect(maxStake).not.toBeNull();
      expect(maxStake).toBeLessThanOrEqual(100);
    });

    it('returns null when budget is insufficient', () => {
      const maxStake = findMaxViableStake(createTestHorses(), 10, 10);

      expect(maxStake).toBeNull();
    });
  });
});

// ============================================================================
// VALIDATOR TESTS
// ============================================================================

describe('Dutch Book Validator', () => {
  describe('validateDutchBook', () => {
    it('validates a profitable Dutch book', () => {
      const result = validateDutchBook({
        horses: createTestHorses(),
        totalStake: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.isProfitable).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('reports errors for too few horses', () => {
      const horses = createTestHorses();
      const firstHorse = horses[0];
      if (!firstHorse) throw new Error('Test setup failed');

      const result = validateDutchBook({
        horses: [firstHorse],
        totalStake: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Minimum 2'))).toBe(true);
    });

    it('reports errors for invalid stake', () => {
      const result = validateDutchBook({
        horses: createTestHorses(),
        totalStake: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Minimum stake'))).toBe(true);
    });

    it('warns when edge is below minimum', () => {
      const result = validateDutchBook({
        horses: createTestHorses(),
        totalStake: 100,
        minEdgeRequired: 50, // Very high requirement
      });

      expect(result.warnings.some((w) => w.includes('below recommended'))).toBe(true);
    });

    it('calculates expected profit correctly', () => {
      const result = validateDutchBook({
        horses: createTestHorses(),
        totalStake: 100,
      });

      expect(result.expectedProfit).toBeGreaterThan(0);
      expect(result.expectedProfitPerDollar).toBeGreaterThan(0);
    });
  });

  describe('validateHorse', () => {
    it('validates a valid horse', () => {
      const result = validateHorse({
        programNumber: 1,
        horseName: 'Test Horse',
        decimalOdds: 3.0,
        oddsDisplay: '2-1',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitizedHorse).not.toBeNull();
    });

    it('rejects invalid program number', () => {
      const result = validateHorse({
        programNumber: -1,
        horseName: 'Test Horse',
        decimalOdds: 3.0,
        oddsDisplay: '2-1',
      });

      expect(result.isValid).toBe(false);
    });

    it('rejects invalid odds', () => {
      const result = validateHorse({
        programNumber: 1,
        horseName: 'Test Horse',
        decimalOdds: 0.5,
        oddsDisplay: 'invalid',
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('analyzeEdge', () => {
    it('classifies excellent edge', () => {
      const analysis = analyzeEdge(20);
      expect(analysis.edgeClass).toBe('excellent');
      expect(analysis.isRecommended).toBe(true);
      expect(analysis.suggestedAction).toBe('bet_confidently');
    });

    it('classifies good edge', () => {
      const analysis = analyzeEdge(12);
      expect(analysis.edgeClass).toBe('good');
      expect(analysis.isRecommended).toBe(true);
    });

    it('classifies moderate edge', () => {
      const analysis = analyzeEdge(7);
      expect(analysis.edgeClass).toBe('moderate');
      expect(analysis.isRecommended).toBe(true);
      expect(analysis.suggestedAction).toBe('bet_cautiously');
    });

    it('classifies marginal edge', () => {
      const analysis = analyzeEdge(2);
      expect(analysis.edgeClass).toBe('marginal');
      expect(analysis.isRecommended).toBe(false);
      expect(analysis.suggestedAction).toBe('consider');
    });

    it('classifies unprofitable edge', () => {
      const analysis = analyzeEdge(-5);
      expect(analysis.edgeClass).toBe('unprofitable');
      expect(analysis.isRecommended).toBe(false);
      expect(analysis.suggestedAction).toBe('avoid');
    });
  });

  describe('classifyEdge', () => {
    it('returns correct classifications', () => {
      expect(classifyEdge(20)).toBe('excellent');
      expect(classifyEdge(15)).toBe('excellent');
      expect(classifyEdge(12)).toBe('good');
      expect(classifyEdge(10)).toBe('good');
      expect(classifyEdge(7)).toBe('moderate');
      expect(classifyEdge(5)).toBe('moderate');
      expect(classifyEdge(3)).toBe('marginal');
      expect(classifyEdge(0.5)).toBe('marginal');
      expect(classifyEdge(-5)).toBe('unprofitable');
    });
  });

  describe('canFormProfitableDutch', () => {
    it('returns true for profitable combination', () => {
      expect(canFormProfitableDutch(createTestHorses())).toBe(true);
    });

    it('returns false for unprofitable combination', () => {
      const overround: DutchHorse[] = [
        { programNumber: 1, horseName: 'A', decimalOdds: 1.5, oddsDisplay: '1-2' },
        { programNumber: 2, horseName: 'B', decimalOdds: 1.5, oddsDisplay: '1-2' },
      ];
      expect(canFormProfitableDutch(overround)).toBe(false);
    });

    it('returns false for single horse', () => {
      const horses = createTestHorses();
      const firstHorse = horses[0];
      if (!firstHorse) throw new Error('Test setup failed');

      expect(canFormProfitableDutch([firstHorse])).toBe(false);
    });
  });
});

// ============================================================================
// OPTIMIZER TESTS
// ============================================================================

describe('Dutch Book Optimizer', () => {
  describe('findOptimalDutchCombinations', () => {
    it('finds profitable combinations', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        minEdgeRequired: 5,
        stake: 100,
      });

      expect(result.combinations.length).toBeGreaterThan(0);
      expect(result.profitableCombinations).toBeGreaterThan(0);
    });

    it('identifies best 2-horse Dutch', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        stake: 100,
      });

      expect(result.best2Horse).not.toBeNull();
      expect(result.best2Horse?.horseCount).toBe(2);
    });

    it('identifies best 3-horse Dutch', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        stake: 100,
      });

      expect(result.best3Horse).not.toBeNull();
      expect(result.best3Horse?.horseCount).toBe(3);
    });

    it('identifies overall best Dutch', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        stake: 100,
      });

      expect(result.overallBest).not.toBeNull();
      expect(result.overallBest?.isProfitable).toBe(true);
    });

    it('respects maximum horses setting', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        maxHorses: 2,
        stake: 100,
      });

      for (const combo of result.combinations) {
        expect(combo.horseCount).toBeLessThanOrEqual(2);
      }
    });

    it('respects minimum edge requirement', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        minEdgeRequired: 20,
        stake: 100,
      });

      for (const combo of result.combinations) {
        expect(combo.edgePercent).toBeGreaterThanOrEqual(20);
      }
    });

    it('filters overlay-only horses when configured', () => {
      const result = findOptimalDutchCombinations({
        horses: createCandidateHorses(),
        overlayOnly: true,
        stake: 100,
      });

      // All horses in combinations should have overlays
      for (const combo of result.combinations) {
        for (const horse of combo.horses) {
          expect(horse.hasOverlay).toBe(true);
        }
      }
    });
  });

  describe('hasProfitableDutch', () => {
    it('returns true when profitable Dutch exists', () => {
      expect(hasProfitableDutch(createCandidateHorses())).toBe(true);
    });

    it('returns false for insufficient horses', () => {
      const horses = createCandidateHorses();
      const firstHorse = horses[0];
      if (!firstHorse) throw new Error('Test setup failed');

      expect(hasProfitableDutch([firstHorse])).toBe(false);
    });
  });

  describe('getTopDutchOpportunities', () => {
    it('returns requested number of opportunities', () => {
      const opportunities = getTopDutchOpportunities(createCandidateHorses(), 3);
      expect(opportunities.length).toBeLessThanOrEqual(3);
    });

    it('ranks by recommendation strength', () => {
      const opportunities = getTopDutchOpportunities(createCandidateHorses(), 5);

      for (let i = 1; i < opportunities.length; i++) {
        const prev = opportunities[i - 1];
        const curr = opportunities[i];
        expect(prev).toBeDefined();
        expect(curr).toBeDefined();
        if (prev && curr) {
          expect(prev.recommendationStrength).toBeGreaterThanOrEqual(curr.recommendationStrength);
        }
      }
    });
  });

  describe('convertToDutchCandidates', () => {
    it('converts horse data to candidates', () => {
      const input = [
        {
          programNumber: 1,
          horseName: 'A',
          morningLineOdds: '2-1',
          score: 190,
          confidence: 80,
          tier: 1 as const,
        },
        {
          programNumber: 2,
          horseName: 'B',
          morningLineOdds: '5-1',
          score: 170,
          confidence: 65,
          tier: 2 as const,
        },
      ];

      const candidates = convertToDutchCandidates(input);

      expect(candidates.length).toBe(2);
      const firstCandidate = candidates[0];
      const secondCandidate = candidates[1];
      expect(firstCandidate).toBeDefined();
      expect(secondCandidate).toBeDefined();
      expect(firstCandidate?.decimalOdds).toBe(3.0);
      expect(secondCandidate?.decimalOdds).toBe(6.0);
    });
  });

  describe('filterDutchCandidates', () => {
    it('filters by minimum confidence', () => {
      const filtered = filterDutchCandidates(createCandidateHorses(), {
        minConfidence: 60,
      });

      for (const horse of filtered) {
        expect(horse.confidence).toBeGreaterThanOrEqual(60);
      }
    });

    it('filters by maximum odds', () => {
      const filtered = filterDutchCandidates(createCandidateHorses(), {
        maxOdds: 10,
      });

      for (const horse of filtered) {
        expect(horse.decimalOdds).toBeLessThanOrEqual(10);
      }
    });

    it('excludes tier 3 when configured', () => {
      const filtered = filterDutchCandidates(createCandidateHorses(), {
        excludeTier3: true,
      });

      for (const horse of filtered) {
        expect(horse.tier).not.toBe(3);
      }
    });
  });
});

// ============================================================================
// DISPLAY TESTS
// ============================================================================

describe('Dutch Book Display', () => {
  describe('formatCurrency', () => {
    it('formats whole dollars', () => {
      expect(formatCurrency(100)).toBe('$100');
    });

    it('formats dollars with cents', () => {
      expect(formatCurrency(54.77, 2)).toBe('$54.77');
    });
  });

  describe('formatCurrencyForWindow', () => {
    it('rounds to nearest $0.10', () => {
      expect(formatCurrencyForWindow(54.77)).toBe('$54.80');
      expect(formatCurrencyForWindow(27.47)).toBe('$27.50');
    });

    it('removes trailing zeros for whole dollars', () => {
      expect(formatCurrencyForWindow(50)).toBe('$50');
    });
  });

  describe('generateDutchSummary', () => {
    it('generates summary for profitable Dutch', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      const summary = generateDutchSummary(result, 'good');

      expect(summary.isProfitable).toBe(true);
      expect(summary.headline).toContain('Dutch Book');
      expect(summary.badgeText).toContain('edge');
    });

    it('generates summary for unprofitable Dutch', () => {
      const overround: DutchHorse[] = [
        { programNumber: 1, horseName: 'A', decimalOdds: 1.5, oddsDisplay: '1-2' },
        { programNumber: 2, horseName: 'B', decimalOdds: 1.5, oddsDisplay: '1-2' },
      ];

      const result = calculateDutchBook({ totalStake: 100, horses: overround });
      const summary = generateDutchSummary(result, 'unprofitable');

      expect(summary.isProfitable).toBe(false);
      expect(summary.headline).toContain('No Profitable');
    });
  });

  describe('generateBetInstruction', () => {
    it('generates window instruction', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      const firstBet = result.bets[0];
      expect(firstBet).toBeDefined();
      if (!firstBet) throw new Error('No bets found');

      const instruction = generateBetInstruction(firstBet, 5);

      expect(instruction.windowInstruction).toContain('Race 5');
      expect(instruction.windowInstruction).toContain('to win on the');
    });
  });

  describe('generateDutchExplanation', () => {
    it('explains the Dutch book', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      const explanations = generateDutchExplanation(result);

      expect(explanations.length).toBeGreaterThan(0);
      const firstExplanation = explanations[0];
      expect(firstExplanation).toBeDefined();
      expect(firstExplanation).toContain('Why Dutch');
    });
  });

  describe('formatDutchForCopy', () => {
    it('formats Dutch for clipboard', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      const copyText = formatDutchForCopy(result, 5);

      expect(copyText).toContain('Dutch Book');
      expect(copyText).toContain('Total:');
      expect(copyText).toContain('Guaranteed Return:');
    });
  });

  describe('formatLiveCalculation', () => {
    it('formats live calculation for valid result', () => {
      const result = calculateDutchBook({
        totalStake: 100,
        horses: createTestHorses(),
      });

      const live = formatLiveCalculation(result);

      expect(live.isValid).toBe(true);
      expect(live.betBreakdown.length).toBeGreaterThan(0);
    });

    it('handles null result', () => {
      const live = formatLiveCalculation(null);

      expect(live.isValid).toBe(false);
      expect(live.warning).toContain('Select at least');
    });
  });
});

// ============================================================================
// SETTINGS TESTS
// ============================================================================

describe('Dutch Settings', () => {
  describe('mergeDutchSettings', () => {
    it('returns defaults for undefined input', () => {
      const merged = mergeDutchSettings(undefined);
      expect(merged).toEqual(DEFAULT_DUTCH_SETTINGS);
    });

    it('merges partial settings with defaults', () => {
      const merged = mergeDutchSettings({
        enabled: true,
        minEdgeRequired: 10,
      });

      expect(merged.enabled).toBe(true);
      expect(merged.minEdgeRequired).toBe(10);
      expect(merged.maxHorses).toBe(DEFAULT_DUTCH_SETTINGS.maxHorses);
    });
  });

  describe('validateDutchSettings', () => {
    it('validates correct settings', () => {
      const result = validateDutchSettings({
        minEdgeRequired: 10,
        maxHorses: 4,
        budgetAllocation: 50,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects invalid edge requirement', () => {
      const result = validateDutchSettings({
        minEdgeRequired: -5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid max horses', () => {
      const result = validateDutchSettings({
        maxHorses: 15,
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('getDutchPresetForRisk', () => {
    it('returns conservative preset', () => {
      const preset = getDutchPresetForRisk('conservative');
      expect(preset.enabled).toBe(true);
      expect(preset.minEdgeRequired).toBe(10);
      expect(preset.maxHorses).toBe(3);
    });

    it('returns moderate preset', () => {
      const preset = getDutchPresetForRisk('moderate');
      expect(preset.minEdgeRequired).toBe(5);
    });

    it('returns aggressive preset', () => {
      const preset = getDutchPresetForRisk('aggressive');
      expect(preset.minEdgeRequired).toBe(3);
      expect(preset.maxHorses).toBe(5);
    });
  });
});
