/**
 * Tests for Value Betting Strategy module
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest';
import {
  generateValueBettingPlan,
  getPureValueStrategy,
  getBalancedValueStrategy,
  getConservativeValueStrategy,
  formatValueBetDisplay,
  getValueBetColor,
  getValueBetIcon,
  getUrgencyColor,
  formatBetSizing,
  DEFAULT_STRATEGY_CONFIG,
  MODE_EV_THRESHOLDS,
  MODE_CONFIDENCE_THRESHOLDS,
} from '../valueBetting';
import type { HorseEntry, RaceHeader } from '../../../types/drf';
import type { HorseScore } from '../../scoring';

// Create mock horse
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

// Create mock race header
function createMockRaceHeader(overrides?: Partial<RaceHeader>): RaceHeader {
  return {
    trackCode: 'AQU',
    trackName: 'Aqueduct',
    raceNumber: 1,
    raceDate: '2024-01-15',
    distance: '6f',
    surface: 'dirt',
    raceType: 'CLM',
    raceClass: 'CLM 25000',
    purse: 25000,
    ageRestriction: '3YO+',
    sexRestriction: null,
    conditions: 'Claiming $25,000',
    fieldSize: 10,
    postTime: '1:00 PM',
    ...overrides,
  } as RaceHeader;
}

// Create mock score
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

describe('generateValueBettingPlan', () => {
  it('should generate a betting plan for a race', () => {
    const horses = [
      {
        horse: createMockHorse({ programNumber: 1, morningLineOdds: '10-1' }),
        score: createMockScore(180),
      },
      {
        horse: createMockHorse({ programNumber: 2, morningLineOdds: '5-1' }),
        score: createMockScore(160),
      },
      {
        horse: createMockHorse({ programNumber: 3, morningLineOdds: '3-1' }),
        score: createMockScore(140),
      },
    ];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader);

    expect(plan.mode).toBe('balanced_value');
    expect(plan.allAnalyzed.length).toBe(3);
    expect(plan.totalRecommendedWager).toBeGreaterThanOrEqual(0);
    expect(plan.stats).toBeDefined();
  });

  it('should rank bets by EV', () => {
    const horses = [
      {
        horse: createMockHorse({ programNumber: 1, morningLineOdds: '20-1' }),
        score: createMockScore(175),
      },
      {
        horse: createMockHorse({ programNumber: 2, morningLineOdds: '3-1' }),
        score: createMockScore(180),
      },
      {
        horse: createMockHorse({ programNumber: 3, morningLineOdds: '10-1' }),
        score: createMockScore(170),
      },
    ];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader);

    // All bets should be ranked
    for (let i = 0; i < plan.allAnalyzed.length - 1; i++) {
      expect(plan.allAnalyzed[i].valueRank).toBeLessThan(plan.allAnalyzed[i + 1].valueRank);
    }
  });

  it('should filter scratched horses', () => {
    const horses = [
      { horse: createMockHorse({ programNumber: 1 }), score: createMockScore(180) },
      {
        horse: createMockHorse({ programNumber: 2 }),
        score: { ...createMockScore(160), isScratched: true },
      },
    ];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader);

    expect(plan.allAnalyzed.length).toBe(1);
  });

  it('should identify best bet', () => {
    const horses = [
      {
        horse: createMockHorse({ programNumber: 1, morningLineOdds: '15-1' }),
        score: createMockScore(185),
      },
      {
        horse: createMockHorse({ programNumber: 2, morningLineOdds: '5-1' }),
        score: createMockScore(160),
      },
    ];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader);

    if (plan.recommendedBets.length > 0) {
      expect(plan.bestBet).toBeDefined();
      expect(plan.bestBet?.valueRank).toBe(1);
    }
  });

  it('should calculate expected profit and ROI', () => {
    const horses = [
      {
        horse: createMockHorse({ programNumber: 1, morningLineOdds: '10-1' }),
        score: createMockScore(180),
      },
    ];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader);

    expect(plan.expectedProfit).toBeDefined();
    expect(typeof plan.expectedROI).toBe('number');
  });

  it('should respect strategy config', () => {
    const horses = [{ horse: createMockHorse({ programNumber: 1 }), score: createMockScore(180) }];
    const raceHeader = createMockRaceHeader();

    const plan = generateValueBettingPlan(horses, raceHeader, {
      mode: 'conservative_value',
      raceBudget: 100,
    });

    expect(plan.mode).toBe('conservative_value');
  });
});

describe('Strategy Presets', () => {
  const horses = [
    {
      horse: createMockHorse({ programNumber: 1, morningLineOdds: '15-1' }),
      score: createMockScore(185),
    },
    {
      horse: createMockHorse({ programNumber: 2, morningLineOdds: '5-1' }),
      score: createMockScore(160),
    },
  ];
  const raceHeader = createMockRaceHeader();

  it('getPureValueStrategy should use pure_value mode', () => {
    const plan = getPureValueStrategy(horses, raceHeader);
    expect(plan.mode).toBe('pure_value');
  });

  it('getBalancedValueStrategy should use balanced_value mode', () => {
    const plan = getBalancedValueStrategy(horses, raceHeader);
    expect(plan.mode).toBe('balanced_value');
  });

  it('getConservativeValueStrategy should use conservative_value mode', () => {
    const plan = getConservativeValueStrategy(horses, raceHeader);
    expect(plan.mode).toBe('conservative_value');
  });

  it('conservative mode should be most selective', () => {
    const pure = getPureValueStrategy(horses, raceHeader);
    const balanced = getBalancedValueStrategy(horses, raceHeader);
    const conservative = getConservativeValueStrategy(horses, raceHeader);

    // Conservative should have same or fewer recommended bets
    expect(conservative.recommendedBets.length).toBeLessThanOrEqual(
      balanced.recommendedBets.length
    );
    expect(balanced.recommendedBets.length).toBeLessThanOrEqual(pure.recommendedBets.length);
  });
});

describe('DEFAULT_STRATEGY_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_STRATEGY_CONFIG.mode).toBe('balanced_value');
    expect(DEFAULT_STRATEGY_CONFIG.raceBudget).toBeGreaterThan(0);
    expect(DEFAULT_STRATEGY_CONFIG.minBetSize).toBeGreaterThan(0);
    expect(DEFAULT_STRATEGY_CONFIG.maxBetSize).toBeGreaterThan(DEFAULT_STRATEGY_CONFIG.minBetSize);
    expect(DEFAULT_STRATEGY_CONFIG.maxBudgetPercentPerBet).toBeLessThanOrEqual(100);
  });
});

describe('MODE_EV_THRESHOLDS', () => {
  it('should have thresholds for all modes', () => {
    expect(MODE_EV_THRESHOLDS.pure_value).toBeDefined();
    expect(MODE_EV_THRESHOLDS.balanced_value).toBeDefined();
    expect(MODE_EV_THRESHOLDS.conservative_value).toBeDefined();
  });

  it('should have ascending thresholds', () => {
    expect(MODE_EV_THRESHOLDS.pure_value).toBeLessThan(MODE_EV_THRESHOLDS.balanced_value);
    expect(MODE_EV_THRESHOLDS.balanced_value).toBeLessThan(MODE_EV_THRESHOLDS.conservative_value);
  });
});

describe('MODE_CONFIDENCE_THRESHOLDS', () => {
  it('should have thresholds for all modes', () => {
    expect(MODE_CONFIDENCE_THRESHOLDS.pure_value).toBeDefined();
    expect(MODE_CONFIDENCE_THRESHOLDS.balanced_value).toBeDefined();
    expect(MODE_CONFIDENCE_THRESHOLDS.conservative_value).toBeDefined();
  });
});

describe('formatValueBetDisplay', () => {
  it('should format bet for display', () => {
    const bet = {
      programNumber: 5,
      horseName: 'Thunder Bolt',
      classification: 'strong_value' as const,
      evPercent: 35,
    } as Parameters<typeof formatValueBetDisplay>[0];

    const display = formatValueBetDisplay(bet);

    expect(display).toContain('#5');
    expect(display).toContain('Thunder Bolt');
    expect(display).toContain('STRONG');
    expect(display).toContain('35%');
  });
});

describe('getValueBetColor', () => {
  it('should return color based on classification', () => {
    const eliteBet = { classification: 'elite_value' as const } as Parameters<
      typeof getValueBetColor
    >[0];
    const strongBet = { classification: 'strong_value' as const } as Parameters<
      typeof getValueBetColor
    >[0];
    const negativeBet = { classification: 'negative_value' as const } as Parameters<
      typeof getValueBetColor
    >[0];

    expect(getValueBetColor(eliteBet)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getValueBetColor(strongBet)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getValueBetColor(negativeBet)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('getValueBetIcon', () => {
  it('should return icon based on classification', () => {
    const bet = { classification: 'elite_value' as const } as Parameters<typeof getValueBetIcon>[0];

    const icon = getValueBetIcon(bet);

    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });
});

describe('getUrgencyColor', () => {
  it('should return colors for all urgency levels', () => {
    expect(getUrgencyColor('immediate')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getUrgencyColor('high')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getUrgencyColor('standard')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getUrgencyColor('low')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('formatBetSizing', () => {
  it('should format positive EV bet sizing', () => {
    const bet = {
      evPercent: 35,
      recommendedAmount: 10,
      minAmount: 5,
      maxAmount: 20,
      kellyFraction: 0.15,
      classification: 'strong_value' as const,
    } as Parameters<typeof formatBetSizing>[0];

    const sizing = formatBetSizing(bet);

    expect(sizing).toContain('$10');
    expect(sizing).toContain('recommended');
  });

  it('should format negative EV with no bet recommendation', () => {
    const bet = {
      evPercent: -10,
      recommendedAmount: 0,
      minAmount: 0,
      maxAmount: 0,
      kellyFraction: 0,
      classification: 'negative_value' as const,
    } as Parameters<typeof formatBetSizing>[0];

    const sizing = formatBetSizing(bet);

    expect(sizing.toLowerCase()).toContain('no bet');
  });
});
