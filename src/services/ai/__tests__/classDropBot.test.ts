/**
 * Tests for Class Drop Bot
 *
 * Tests for the class drop analysis functionality including:
 * - calculateClassDrop function
 * - extractClassData helper
 * - analyzeClassDropsLocal function
 * - Class drop thresholds (MAJOR, MODERATE, MINOR, NONE, RISING)
 * - Integration with value horse identification
 */

import { describe, it, expect } from 'vitest';
import {
  calculateClassDrop,
  extractClassData,
  analyzeClassDropsLocal,
  formatClassAmount,
  generateDropReason,
} from '../prompt';
// Types are used implicitly via the prompt functions

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

interface MockPastPerformance {
  purse: number;
  claimingPrice: number | null;
  classification: string;
}

interface MockHorse {
  programNumber: number;
  horseName: string;
  pastPerformances: MockPastPerformance[];
}

interface MockRaceHeader {
  purse: number;
  claimingPriceMin: number | null;
  classification: string;
}

function createMockPastPerformance(
  overrides: Partial<MockPastPerformance> = {}
): MockPastPerformance {
  return {
    purse: 25000,
    claimingPrice: null,
    classification: 'claiming',
    ...overrides,
  };
}

function createMockHorse(overrides: Partial<MockHorse> = {}): MockHorse {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    pastPerformances: [
      createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
      createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
      createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
    ],
    ...overrides,
  };
}

function createMockRaceHeader(overrides: Partial<MockRaceHeader> = {}): MockRaceHeader {
  return {
    purse: 15000,
    claimingPriceMin: 15000,
    classification: 'claiming',
    ...overrides,
  };
}

// ============================================================================
// UNIT TESTS: extractClassData
// ============================================================================

describe('extractClassData', () => {
  it('should extract today class data from race header', () => {
    const horse = createMockHorse();
    const header = createMockRaceHeader({ purse: 20000, claimingPriceMin: 18000 });

    const result = extractClassData(horse, header);

    expect(result.purseToday).toBe(20000);
    expect(result.claimingToday).toBe(18000);
    expect(result.raceTypeToday).toBe('claiming');
  });

  it('should calculate average purse from last 3 races', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ purse: 30000 }),
        createMockPastPerformance({ purse: 24000 }),
        createMockPastPerformance({ purse: 21000 }),
      ],
    });
    const header = createMockRaceHeader();

    const result = extractClassData(horse, header);

    expect(result.purseAvgPast3).toBe(25000); // (30000 + 24000 + 21000) / 3 = 25000
  });

  it('should calculate average claiming price from last 3 races', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ claimingPrice: 30000 }),
        createMockPastPerformance({ claimingPrice: 24000 }),
        createMockPastPerformance({ claimingPrice: 21000 }),
      ],
    });
    const header = createMockRaceHeader();

    const result = extractClassData(horse, header);

    expect(result.claimingAvgPast3).toBe(25000);
  });

  it('should handle null claiming prices', () => {
    const horse = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ claimingPrice: null }),
        createMockPastPerformance({ claimingPrice: null }),
        createMockPastPerformance({ claimingPrice: null }),
      ],
    });
    const header = createMockRaceHeader({ claimingPriceMin: null });

    const result = extractClassData(horse, header);

    expect(result.claimingToday).toBeNull();
    expect(result.claimingAvgPast3).toBeNull();
  });

  it('should handle fewer than 3 past performances', () => {
    const horse = createMockHorse({
      pastPerformances: [createMockPastPerformance({ purse: 20000 })],
    });
    const header = createMockRaceHeader();

    const result = extractClassData(horse, header);

    expect(result.purseAvgPast3).toBe(20000);
  });
});

// ============================================================================
// UNIT TESTS: calculateClassDrop
// ============================================================================

describe('calculateClassDrop', () => {
  it('should identify MAJOR class drop (40%+)', () => {
    // Horse averaging $50,000 claiming, now running for $25,000 (50% drop)
    const horse = createMockHorse({
      programNumber: 4,
      horseName: 'Major Dropper',
      pastPerformances: [
        createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
        createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
        createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 30000, claimingPriceMin: 25000 });

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('MAJOR');
    expect(result.dropPercentage).toBeGreaterThanOrEqual(40);
    expect(result.isValueCandidate).toBe(true);
  });

  it('should identify MODERATE class drop (25-39%)', () => {
    // Horse averaging $20,000 claiming, now running for $14,000 (30% drop)
    const horse = createMockHorse({
      programNumber: 3,
      horseName: 'Moderate Dropper',
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 18000, claimingPriceMin: 14000 });

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('MODERATE');
    expect(result.dropPercentage).toBeGreaterThanOrEqual(25);
    expect(result.dropPercentage).toBeLessThan(40);
    expect(result.isValueCandidate).toBe(true);
  });

  it('should identify MINOR class drop (10-24%)', () => {
    // Horse averaging $20,000, now running for $16,000 (20% drop)
    const horse = createMockHorse({
      programNumber: 2,
      horseName: 'Minor Dropper',
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 20000, claimingPriceMin: 16000 });

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('MINOR');
    expect(result.dropPercentage).toBeGreaterThanOrEqual(10);
    expect(result.dropPercentage).toBeLessThan(25);
    expect(result.isValueCandidate).toBe(false);
  });

  it('should NOT flag minor drops as value candidates', () => {
    // Horse averaging $20,000, now running for $18,000 (10% drop)
    const horse = createMockHorse({
      programNumber: 1,
      horseName: 'Slight Dropper',
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 22000, claimingPriceMin: 18000 });

    const result = calculateClassDrop(horse, header);

    expect(result.isValueCandidate).toBe(false);
  });

  it('should identify RISING class (moving UP 10%+)', () => {
    // Horse averaging $20,000, now running for $25,000 (25% rise)
    const horse = createMockHorse({
      programNumber: 5,
      horseName: 'Class Riser',
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 30000, claimingPriceMin: 25000 });

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('RISING');
    expect(result.dropPercentage).toBeLessThan(-10);
    expect(result.isValueCandidate).toBe(false);
  });

  it('should identify NONE when class is similar (-10% to +10%)', () => {
    // Horse averaging $20,000, now running for $20,000 (0% change)
    const horse = createMockHorse({
      programNumber: 6,
      horseName: 'Level Runner',
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 20000 }),
      ],
    });
    const header = createMockRaceHeader({ purse: 25000, claimingPriceMin: 20000 });

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('NONE');
    expect(result.dropPercentage).toBeGreaterThanOrEqual(-10);
    expect(result.dropPercentage).toBeLessThan(10);
    expect(result.isValueCandidate).toBe(false);
  });

  it('should handle claiming vs non-claiming races (claiming takes precedence)', () => {
    // Past: ran in allowance ($75K purse, no claiming)
    // Today: claiming $15K
    const horse = createMockHorse({
      programNumber: 7,
      horseName: 'Allowance Dropper',
      pastPerformances: [
        createMockPastPerformance({
          purse: 75000,
          claimingPrice: null,
          classification: 'allowance',
        }),
        createMockPastPerformance({
          purse: 75000,
          claimingPrice: null,
          classification: 'allowance',
        }),
        createMockPastPerformance({
          purse: 75000,
          claimingPrice: null,
          classification: 'allowance',
        }),
      ],
    });
    const header = createMockRaceHeader({ purse: 20000, claimingPriceMin: 15000 });

    const result = calculateClassDrop(horse, header);

    // Should use purse since past claiming is null
    // 75000 avg to 15000 today = 80% drop (uses claiming today since available)
    expect(result.dropType).toBe('MAJOR');
    expect(result.isValueCandidate).toBe(true);
  });

  it('should return UNKNOWN when no past performance data', () => {
    const horse = createMockHorse({
      programNumber: 8,
      horseName: 'First Timer',
      pastPerformances: [],
    });
    const header = createMockRaceHeader();

    const result = calculateClassDrop(horse, header);

    expect(result.dropType).toBe('UNKNOWN');
    expect(result.isValueCandidate).toBe(false);
  });
});

// ============================================================================
// UNIT TESTS: analyzeClassDropsLocal
// ============================================================================

describe('analyzeClassDropsLocal', () => {
  it('should analyze all horses in a race', () => {
    const horses = [
      createMockHorse({
        programNumber: 1,
        horseName: 'Horse A',
        pastPerformances: [
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
        ],
      }),
      createMockHorse({
        programNumber: 2,
        horseName: 'Horse B',
        pastPerformances: [
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
        ],
      }),
    ];
    const header = createMockRaceHeader({ purse: 25000, claimingPriceMin: 25000 });

    const result = analyzeClassDropsLocal(horses, header);

    expect(result.analysis.horsesWithClassDrop).toHaveLength(2);
    expect(result.analysis.classDroppers).toBe(1); // Only Horse A has a significant drop
  });

  it('should identify the biggest class dropper', () => {
    const horses = [
      createMockHorse({
        programNumber: 1,
        horseName: 'Big Dropper',
        pastPerformances: [
          createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 60000, claimingPrice: 50000 }),
        ],
      }),
      createMockHorse({
        programNumber: 2,
        horseName: 'Small Dropper',
        pastPerformances: [
          createMockPastPerformance({ purse: 35000, claimingPrice: 30000 }),
          createMockPastPerformance({ purse: 35000, claimingPrice: 30000 }),
          createMockPastPerformance({ purse: 35000, claimingPrice: 30000 }),
        ],
      }),
    ];
    const header = createMockRaceHeader({ purse: 25000, claimingPriceMin: 25000 });

    const result = analyzeClassDropsLocal(horses, header);

    expect(result.analysis.biggestDrop).not.toBeNull();
    expect(result.analysis.biggestDrop?.programNumber).toBe(1);
    expect(result.analysis.biggestDrop?.horseName).toBe('Big Dropper');
  });

  it('should return null biggestDrop when no significant drops exist', () => {
    const horses = [
      createMockHorse({
        programNumber: 1,
        horseName: 'Level Horse',
        pastPerformances: [
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
          createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
        ],
      }),
    ];
    const header = createMockRaceHeader({ purse: 25000, claimingPriceMin: 25000 });

    const result = analyzeClassDropsLocal(horses, header);

    expect(result.analysis.biggestDrop).toBeNull();
    expect(result.analysis.classDroppers).toBe(0);
  });

  it('should calculate confidence based on data completeness', () => {
    // All horses have data
    const horses = [
      createMockHorse({
        programNumber: 1,
        pastPerformances: [
          createMockPastPerformance({ purse: 25000 }),
          createMockPastPerformance({ purse: 25000 }),
        ],
      }),
      createMockHorse({
        programNumber: 2,
        pastPerformances: [
          createMockPastPerformance({ purse: 25000 }),
          createMockPastPerformance({ purse: 25000 }),
        ],
      }),
    ];
    const header = createMockRaceHeader();

    const result = analyzeClassDropsLocal(horses, header);

    expect(result.confidence).toBe('HIGH');
  });

  it('should determine field class level based on purse', () => {
    const horses = [createMockHorse()];

    // High class (purse >= $100K)
    let result = analyzeClassDropsLocal(horses, {
      purse: 150000,
      claimingPriceMin: null,
      classification: 'stakes',
    });
    expect(result.analysis.fieldClassLevel).toBe('HIGH');

    // Medium class ($40K <= purse < $100K)
    result = analyzeClassDropsLocal(horses, {
      purse: 50000,
      claimingPriceMin: null,
      classification: 'allowance',
    });
    expect(result.analysis.fieldClassLevel).toBe('MEDIUM');

    // Low class (purse < $40K)
    result = analyzeClassDropsLocal(horses, {
      purse: 20000,
      claimingPriceMin: 15000,
      classification: 'claiming',
    });
    expect(result.analysis.fieldClassLevel).toBe('LOW');
  });
});

// ============================================================================
// UNIT TESTS: formatClassAmount
// ============================================================================

describe('formatClassAmount', () => {
  it('should format amounts >= 1M as M', () => {
    expect(formatClassAmount(1500000)).toBe('$1.5M');
    expect(formatClassAmount(2000000)).toBe('$2.0M');
  });

  it('should format amounts >= 1K as K', () => {
    expect(formatClassAmount(25000)).toBe('$25K');
    expect(formatClassAmount(100000)).toBe('$100K');
    expect(formatClassAmount(12500)).toBe('$13K'); // Rounds
  });

  it('should format amounts < 1K as-is', () => {
    expect(formatClassAmount(500)).toBe('$500');
  });
});

// ============================================================================
// UNIT TESTS: generateDropReason
// ============================================================================

describe('generateDropReason', () => {
  const mockClassIndicators = {
    purseToday: 15000,
    purseAvgPast3: 30000,
    claimingToday: 15000,
    claimingAvgPast3: 30000,
    raceTypeToday: 'claiming',
    raceTypePast: ['claiming', 'claiming', 'claiming'],
  };

  it('should generate appropriate reason for MAJOR drop', () => {
    const reason = generateDropReason('MAJOR', 50, mockClassIndicators);
    expect(reason).toContain('much tougher competition');
    expect(reason).toContain('easier horses');
  });

  it('should generate appropriate reason for MODERATE drop', () => {
    const reason = generateDropReason('MODERATE', 30, mockClassIndicators);
    expect(reason).toContain('stepping down');
    expect(reason).toContain('easier competition');
  });

  it('should generate appropriate reason for MINOR drop', () => {
    const reason = generateDropReason('MINOR', 15, mockClassIndicators);
    expect(reason).toContain('slightly easier');
  });

  it('should generate appropriate reason for RISING class', () => {
    const reason = generateDropReason('RISING', -30, mockClassIndicators);
    expect(reason).toContain('tougher competition');
    expect(reason).toContain('moving UP');
  });

  it('should generate appropriate reason for NONE (no change)', () => {
    const reason = generateDropReason('NONE', 0, mockClassIndicators);
    expect(reason).toContain('similar level');
  });

  it('should generate appropriate reason for UNKNOWN', () => {
    const reason = generateDropReason('UNKNOWN', 0, mockClassIndicators);
    expect(reason).toContain('Insufficient');
  });
});

// ============================================================================
// INTEGRATION TESTS: Bot Convergence with Class Drop
// ============================================================================

describe('Class Drop Integration', () => {
  it('should flag class droppers as value candidates for bot convergence', () => {
    // This tests that horses with significant class drops should contribute
    // to bot convergence when combined with other signals

    const horses = [
      createMockHorse({
        programNumber: 4,
        horseName: 'Value Play',
        pastPerformances: [
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
          createMockPastPerformance({ purse: 50000, claimingPrice: 50000 }),
        ],
      }),
    ];
    const header = createMockRaceHeader({ purse: 25000, claimingPriceMin: 25000 });

    const result = analyzeClassDropsLocal(horses, header);

    // Horse #4 should be a value candidate
    const valueCandidate = result.analysis.horsesWithClassDrop.find((h) => h.programNumber === 4);
    expect(valueCandidate).toBeDefined();
    expect(valueCandidate?.isValueCandidate).toBe(true);
    expect(valueCandidate?.dropType).toBe('MAJOR');
  });

  it('should calculate correct drop percentages for edge cases', () => {
    // Test exact threshold boundaries

    // Exactly 40% drop should be MAJOR
    const horse40 = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
        createMockPastPerformance({ purse: 25000, claimingPrice: 25000 }),
      ],
    });
    const header40 = createMockRaceHeader({ purse: 15000, claimingPriceMin: 15000 }); // 40% drop
    const result40 = calculateClassDrop(horse40, header40);
    expect(result40.dropType).toBe('MAJOR');

    // Exactly 25% drop should be MODERATE
    const horse25 = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
      ],
    });
    const header25 = createMockRaceHeader({ purse: 15000, claimingPriceMin: 15000 }); // 25% drop
    const result25 = calculateClassDrop(horse25, header25);
    expect(result25.dropType).toBe('MODERATE');

    // Exactly 10% drop should be MINOR
    const horse10 = createMockHorse({
      pastPerformances: [
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
        createMockPastPerformance({ purse: 20000, claimingPrice: 20000 }),
      ],
    });
    const header10 = createMockRaceHeader({ purse: 18000, claimingPriceMin: 18000 }); // 10% drop
    const result10 = calculateClassDrop(horse10, header10);
    expect(result10.dropType).toBe('MINOR');
  });
});
