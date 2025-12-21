/**
 * Tests for Value Detector module
 *
 * Comprehensive tests covering:
 * - EV calculations
 * - Value classifications
 * - Probability conversions
 * - Edge calculations
 * - Display helpers
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest';
import {
  scoreToWinProbability,
  oddsToMarketProbability,
  calculateEV,
  calculateEdge,
  calculateOverlayPercent,
  classifyValue,
  probabilityToFairOdds,
  formatOddsDisplay,
  formatEVPercent,
  formatEdge,
  getEVColor,
  getValueShortLabel,
  isValuePlay,
  analyzeValue,
  EV_THRESHOLDS,
  VALUE_CLASSIFICATION_META,
} from '../valueDetector';
import type { HorseEntry } from '../../../types/drf';
import type { HorseScore } from '../../scoring';

// Mock horse entry for testing
function createMockHorse(overrides?: Partial<HorseEntry>): HorseEntry {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    postPosition: 1,
    morningLineOdds: '5-1',
    jockeyName: 'Test Jockey',
    trainerName: 'Test Trainer',
    ownerName: 'Test Owner',
    owningSilks: 'Red and Blue',
    weight: 122,
    medication: '',
    equipment: {
      raw: '',
      firstTimeEquipment: [],
    },
    claimingPrice: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 50000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 1,
    currentYearEarnings: 20000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 2,
    previousYearShows: 1,
    previousYearEarnings: 30000,
    daysOff: 14,
    bestBeyer: 85,
    averageBeyer: 80,
    runningStyle: 'E',
    earlySpeedRating: 80,
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Damsire',
    whereBred: 'KY',
    sex: 'C',
    age: 4,
    color: 'Bay',
    pastPerformances: [],
    workoutHistory: [],
    trainerStats: null,
    jockeyStats: null,
    ...overrides,
  } as HorseEntry;
}

// Mock score for testing
function createMockScore(total: number, overrides?: Partial<HorseScore>): HorseScore {
  return {
    total,
    isScratched: false,
    confidenceLevel: 'medium',
    dataQuality: 70,
    breakdown: {
      connections: { total: 30, trainer: 20, jockey: 10, partnershipBonus: 0, reasoning: '' },
      postPosition: { total: 30, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
      speedClass: {
        total: 30,
        speedScore: 20,
        classScore: 10,
        bestFigure: 85,
        classMovement: 'lateral',
        reasoning: '',
      },
      form: {
        total: 20,
        recentFormScore: 15,
        layoffScore: 5,
        consistencyBonus: 0,
        formTrend: 'steady',
        reasoning: '',
      },
      equipment: { total: 10, hasChanges: false, reasoning: '' },
      pace: { total: 25, runningStyle: 'E', paceFit: 'good', reasoning: '' },
    },
    ...overrides,
  } as HorseScore;
}

describe('scoreToWinProbability', () => {
  it('should return 75% for elite scores (200+)', () => {
    const prob = scoreToWinProbability(200);
    expect(prob).toBeGreaterThanOrEqual(70);
    expect(prob).toBeLessThanOrEqual(85);
  });

  it('should return ~65% for strong scores (180-199)', () => {
    const prob = scoreToWinProbability(185);
    expect(prob).toBeGreaterThanOrEqual(60);
    expect(prob).toBeLessThanOrEqual(75);
  });

  it('should return ~55% for good scores (160-179)', () => {
    const prob = scoreToWinProbability(165);
    expect(prob).toBeGreaterThanOrEqual(50);
    expect(prob).toBeLessThanOrEqual(65);
  });

  it('should return ~45% for fair scores (140-159)', () => {
    const prob = scoreToWinProbability(145);
    expect(prob).toBeGreaterThanOrEqual(40);
    expect(prob).toBeLessThanOrEqual(55);
  });

  it('should return ~35% for below average scores (120-139)', () => {
    const prob = scoreToWinProbability(125);
    expect(prob).toBeGreaterThanOrEqual(30);
    expect(prob).toBeLessThanOrEqual(45);
  });

  it('should return ~25% for weak scores (100-119)', () => {
    const prob = scoreToWinProbability(105);
    expect(prob).toBeGreaterThanOrEqual(20);
    expect(prob).toBeLessThanOrEqual(35);
  });

  it('should return ~15% for poor scores (<100)', () => {
    const prob = scoreToWinProbability(80);
    expect(prob).toBeGreaterThanOrEqual(10);
    expect(prob).toBeLessThanOrEqual(25);
  });

  it('should handle edge cases', () => {
    expect(scoreToWinProbability(0)).toBeGreaterThan(0);
    expect(scoreToWinProbability(240)).toBeLessThanOrEqual(85);
    expect(scoreToWinProbability(-10)).toBeGreaterThan(0);
    expect(scoreToWinProbability(300)).toBeLessThanOrEqual(85);
  });
});

describe('oddsToMarketProbability', () => {
  it('should convert 2/1 to ~33%', () => {
    const prob = oddsToMarketProbability('2-1');
    expect(prob).toBeCloseTo(33.33, 0);
  });

  it('should convert 5/1 to ~16.7%', () => {
    const prob = oddsToMarketProbability('5-1');
    expect(prob).toBeCloseTo(16.67, 0);
  });

  it('should convert 10/1 to ~9.1%', () => {
    const prob = oddsToMarketProbability('10-1');
    expect(prob).toBeCloseTo(9.09, 0);
  });

  it('should convert EVEN to 50%', () => {
    const prob = oddsToMarketProbability('EVEN');
    expect(prob).toBeCloseTo(50, 0);
  });

  it('should convert 1/2 to ~66.7%', () => {
    const prob = oddsToMarketProbability('1/2');
    expect(prob).toBeCloseTo(66.67, 0);
  });

  it('should convert 3/2 to 40%', () => {
    const prob = oddsToMarketProbability('3/2');
    expect(prob).toBeCloseTo(40, 0);
  });

  it('should handle invalid odds gracefully', () => {
    expect(oddsToMarketProbability('')).toBe(10);
    expect(oddsToMarketProbability('invalid')).toBeGreaterThan(0);
  });
});

describe('calculateEV', () => {
  it('should return positive EV when our probability exceeds market', () => {
    // 50% win prob at 3.0 decimal odds (2/1)
    // EV = (0.5 * 2) - (0.5 * 1) = 1 - 0.5 = 0.5
    const ev = calculateEV(50, 3.0);
    expect(ev).toBeCloseTo(0.5, 1);
  });

  it('should return negative EV when market probability exceeds ours', () => {
    // 20% win prob at 3.0 decimal odds
    // EV = (0.2 * 2) - (0.8 * 1) = 0.4 - 0.8 = -0.4
    const ev = calculateEV(20, 3.0);
    expect(ev).toBeCloseTo(-0.4, 1);
  });

  it('should return zero EV at fair odds', () => {
    // 33.33% win prob at 3.0 decimal odds (true fair odds)
    const ev = calculateEV(33.33, 3.0);
    expect(Math.abs(ev)).toBeLessThan(0.05);
  });

  it('should handle edge cases', () => {
    expect(calculateEV(0, 3.0)).toBe(0);
    expect(calculateEV(100, 3.0)).toBe(0);
    expect(calculateEV(50, 1)).toBe(-1);
    expect(calculateEV(50, 0)).toBe(-1);
  });
});

describe('calculateEdge', () => {
  it('should return positive edge when we have advantage', () => {
    const edge = calculateEdge(50, 33);
    expect(edge).toBe(17);
  });

  it('should return negative edge when market has advantage', () => {
    const edge = calculateEdge(25, 50);
    expect(edge).toBe(-25);
  });

  it('should return zero when probabilities match', () => {
    const edge = calculateEdge(33, 33);
    expect(edge).toBe(0);
  });
});

describe('calculateOverlayPercent', () => {
  it('should return positive overlay when odds are better than fair', () => {
    // Fair odds 3.0, actual odds 4.0 = 33% overlay
    const overlay = calculateOverlayPercent(4.0, 3.0);
    expect(overlay).toBeCloseTo(33.33, 0);
  });

  it('should return negative overlay when odds are worse than fair', () => {
    // Fair odds 4.0, actual odds 3.0 = -25% underlay
    const overlay = calculateOverlayPercent(3.0, 4.0);
    expect(overlay).toBeCloseTo(-25, 0);
  });

  it('should return zero when odds match fair value', () => {
    const overlay = calculateOverlayPercent(3.0, 3.0);
    expect(overlay).toBe(0);
  });
});

describe('classifyValue', () => {
  it('should classify elite value (EV > 50%)', () => {
    expect(classifyValue(55)).toBe('elite_value');
    expect(classifyValue(75)).toBe('elite_value');
  });

  it('should classify strong value (EV 25-50%)', () => {
    expect(classifyValue(25)).toBe('strong_value');
    expect(classifyValue(35)).toBe('strong_value');
    expect(classifyValue(49)).toBe('strong_value');
  });

  it('should classify moderate value (EV 10-24%)', () => {
    expect(classifyValue(10)).toBe('moderate_value');
    expect(classifyValue(15)).toBe('moderate_value');
    expect(classifyValue(24)).toBe('moderate_value');
  });

  it('should classify slight value (EV 5-9%)', () => {
    expect(classifyValue(5)).toBe('slight_value');
    expect(classifyValue(7)).toBe('slight_value');
    expect(classifyValue(9)).toBe('slight_value');
  });

  it('should classify no value (EV 0-4%)', () => {
    expect(classifyValue(0)).toBe('no_value');
    expect(classifyValue(2)).toBe('no_value');
    expect(classifyValue(4)).toBe('no_value');
  });

  it('should classify negative value (EV < 0)', () => {
    expect(classifyValue(-1)).toBe('negative_value');
    expect(classifyValue(-10)).toBe('negative_value');
    expect(classifyValue(-50)).toBe('negative_value');
  });
});

describe('probabilityToFairOdds', () => {
  it('should convert 50% to 2.0 decimal odds', () => {
    const odds = probabilityToFairOdds(50);
    expect(odds).toBe(2);
  });

  it('should convert 33% to ~3.0 decimal odds', () => {
    const odds = probabilityToFairOdds(33.33);
    expect(odds).toBeCloseTo(3, 1);
  });

  it('should convert 25% to 4.0 decimal odds', () => {
    const odds = probabilityToFairOdds(25);
    expect(odds).toBe(4);
  });

  it('should convert 10% to 10.0 decimal odds', () => {
    const odds = probabilityToFairOdds(10);
    expect(odds).toBe(10);
  });

  it('should handle edge cases', () => {
    expect(probabilityToFairOdds(0)).toBeGreaterThan(1);
    expect(probabilityToFairOdds(100)).toBeLessThanOrEqual(1.02);
  });
});

describe('formatOddsDisplay', () => {
  it('should format decimal odds to traditional display', () => {
    expect(formatOddsDisplay(2.0)).toBe('EVEN');
    expect(formatOddsDisplay(3.0)).toBe('2-1');
    expect(formatOddsDisplay(6.0)).toBe('5-1');
    expect(formatOddsDisplay(11.0)).toBe('10-1');
  });

  it('should handle fractional odds', () => {
    expect(formatOddsDisplay(2.5)).toBe('3-2');
    expect(formatOddsDisplay(1.5)).toBe('1-2');
  });
});

describe('formatEVPercent', () => {
  it('should format positive EV with plus sign', () => {
    expect(formatEVPercent(25)).toBe('+25.0%');
    expect(formatEVPercent(50.5)).toBe('+50.5%');
  });

  it('should format negative EV without plus sign', () => {
    expect(formatEVPercent(-15)).toBe('-15.0%');
  });

  it('should format zero correctly', () => {
    expect(formatEVPercent(0)).toBe('+0.0%');
  });
});

describe('formatEdge', () => {
  it('should format positive edge with plus sign', () => {
    expect(formatEdge(17)).toBe('+17.0%');
  });

  it('should format negative edge', () => {
    expect(formatEdge(-10)).toBe('-10.0%');
  });
});

describe('getEVColor', () => {
  it('should return gold for elite value', () => {
    const color = getEVColor(55);
    expect(color).toBe('#fbbf24');
  });

  it('should return green for strong value', () => {
    const color = getEVColor(30);
    expect(color).toBe('#22c55e');
  });

  it('should return teal for moderate value', () => {
    const color = getEVColor(15);
    expect(color).toBe('#36d1da');
  });

  it('should return red for negative value', () => {
    const color = getEVColor(-10);
    expect(color).toBe('#ef4444');
  });
});

describe('getValueShortLabel', () => {
  it('should return ELITE for elite value', () => {
    expect(getValueShortLabel(55)).toBe('ELITE');
  });

  it('should return STRONG for strong value', () => {
    expect(getValueShortLabel(30)).toBe('STRONG');
  });

  it('should return AVOID for negative value', () => {
    expect(getValueShortLabel(-10)).toBe('AVOID');
  });
});

describe('isValuePlay', () => {
  it('should return true when EV exceeds threshold', () => {
    expect(isValuePlay(10)).toBe(true);
    expect(isValuePlay(25)).toBe(true);
  });

  it('should return false when EV below threshold', () => {
    expect(isValuePlay(3)).toBe(false);
    expect(isValuePlay(-5)).toBe(false);
  });

  it('should respect custom threshold', () => {
    expect(isValuePlay(15, 20)).toBe(false);
    expect(isValuePlay(15, 10)).toBe(true);
  });
});

describe('analyzeValue', () => {
  it('should perform complete value analysis for a horse', () => {
    const horse = createMockHorse({ morningLineOdds: '5-1' });
    const score = createMockScore(180);

    const analysis = analyzeValue(horse, score);

    expect(analysis.programNumber).toBe(1);
    expect(analysis.horseName).toBe('Test Horse');
    expect(analysis.score).toBe(180);
    expect(analysis.ourProbability).toBeGreaterThan(0);
    expect(analysis.marketProbability).toBeGreaterThan(0);
    expect(analysis.edge).toBeDefined();
    expect(analysis.evPerDollar).toBeDefined();
    expect(analysis.evPercent).toBeDefined();
    expect(analysis.classification).toBeDefined();
    expect(analysis.explanation.length).toBeGreaterThan(0);
    expect(analysis.recommendation).toBeDefined();
  });

  it('should identify positive EV correctly', () => {
    // High score with long odds should be positive EV
    const horse = createMockHorse({ morningLineOdds: '10-1' });
    const score = createMockScore(175); // Strong score

    const analysis = analyzeValue(horse, score);

    // At 10-1 odds (11.0 decimal, 9.1% implied prob)
    // Score of 175 should give ~55% probability
    // This should be significantly positive EV
    expect(analysis.isPositiveEV).toBe(true);
    expect(analysis.evPercent).toBeGreaterThan(0);
    expect(analysis.shouldBet).toBe(true);
  });

  it('should identify negative EV correctly', () => {
    // Low score with short odds should be negative EV
    const horse = createMockHorse({ morningLineOdds: '1-2' });
    const score = createMockScore(120); // Below average score

    const analysis = analyzeValue(horse, score);

    // At 1-2 odds (1.5 decimal, 66.7% implied prob)
    // Score of 120 should give ~35% probability
    // This should be negative EV
    expect(analysis.isPositiveEV).toBe(false);
    expect(analysis.evPercent).toBeLessThan(0);
    expect(analysis.shouldBet).toBe(false);
  });

  it('should calculate edge correctly', () => {
    const horse = createMockHorse({ morningLineOdds: '4-1' });
    const score = createMockScore(160);

    const analysis = analyzeValue(horse, score);

    // Edge should be our probability minus market probability
    expect(analysis.edge).toBeCloseTo(analysis.ourProbability - analysis.marketProbability, 1);
  });

  it('should include fair odds in analysis', () => {
    const horse = createMockHorse();
    const score = createMockScore(150);

    const analysis = analyzeValue(horse, score);

    expect(analysis.fairOdds).toBeGreaterThan(1);
    expect(analysis.fairOddsDisplay).toBeDefined();
  });
});

describe('VALUE_CLASSIFICATION_META', () => {
  it('should have metadata for all classifications', () => {
    const classifications = [
      'elite_value',
      'strong_value',
      'moderate_value',
      'slight_value',
      'no_value',
      'negative_value',
    ];

    for (const classification of classifications) {
      const meta =
        VALUE_CLASSIFICATION_META[classification as keyof typeof VALUE_CLASSIFICATION_META];
      expect(meta).toBeDefined();
      expect(meta.name).toBeDefined();
      expect(meta.color).toBeDefined();
      expect(meta.icon).toBeDefined();
      expect(meta.action).toBeDefined();
    }
  });
});

describe('EV_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(EV_THRESHOLDS.elite).toBe(50);
    expect(EV_THRESHOLDS.strong).toBe(25);
    expect(EV_THRESHOLDS.moderate).toBe(10);
    expect(EV_THRESHOLDS.slight).toBe(5);
    expect(EV_THRESHOLDS.none).toBe(0);
  });
});
