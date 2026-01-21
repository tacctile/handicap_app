/**
 * Unit tests for the AI Metrics System
 *
 * Tests for:
 * - Storage (saveDecisionRecord, getDecisionRecord, updateWithResults, clearAllRecords)
 * - Calculator (calculatePerformanceMetrics with various scenarios)
 * - Recorder (recordAIDecision, buildDecisionRecord)
 * - Export (exportMetricsReport)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { AIDecisionRecord, RaceResults, AIPerformanceMetrics } from '../types';
import type { AIRaceAnalysis } from '../../types';
import type { ParsedRace } from '../../../../types/drf';
import type { RaceScoringResult, HorseScoreForAI } from '../../../../types/scoring';
import { calculatePerformanceMetrics, compareToBaseline } from '../calculator';
import { buildDecisionRecord } from '../recorder';
import {
  saveDecisionRecord,
  getDecisionRecord,
  getAllDecisionRecords,
  updateWithResults,
  clearAllRecords,
  resetStorageForTesting,
} from '../storage';
import { exportMetricsReport } from '../export';

// ============================================================================
// TEST DATA BUILDERS
// ============================================================================

function createMockDecisionRecord(overrides: Partial<AIDecisionRecord> = {}): AIDecisionRecord {
  return {
    raceId: 'TST-2024-01-01-R1',
    trackCode: 'TST',
    raceNumber: 1,
    raceDate: '2024-01-01',
    fieldSize: 8,
    algorithmTopPick: 3,
    algorithmTop3: [3, 1, 5],
    algorithmScores: [
      { programNumber: 3, score: 200, rank: 1 },
      { programNumber: 1, score: 185, rank: 2 },
      { programNumber: 5, score: 170, rank: 3 },
      { programNumber: 2, score: 160, rank: 4 },
    ],
    aiTopPick: 3,
    aiValuePlay: 5,
    aiTop3: [3, 1, 5],
    aiAvoidList: [7, 8],
    aiConfidence: 'HIGH',
    isOverride: false,
    overrideReason: null,
    tripTroubleHorses: [],
    paceAdvantageHorses: [3],
    vulnerableFavorite: false,
    fieldType: 'SEPARATED',
    betType: 'KEY',
    exactaHorses: [3, 1, 5, 2],
    trifectaHorses: [3, 1, 5, 2, 4],
    processingTimeMs: 1500,
    timestamp: new Date().toISOString(),
    actualWinner: null,
    actualExacta: null,
    actualTrifecta: null,
    resultRecorded: false,
    ...overrides,
  };
}

function createMockRace(): ParsedRace {
  return {
    header: {
      raceNumber: 1,
      trackName: 'Test Track',
      trackCode: 'TST',
      raceDate: '2024-01-01',
      distance: '6 Furlongs',
      surface: 'dirt',
      trackCondition: 'fast',
      classification: 'allowance',
      purseFormatted: '$50,000',
      purse: 50000,
      condition: 'fast',
      postTime: '1:00 PM',
      raceType: 'ALW',
    },
    horses: [
      { programNumber: 1, horseName: 'Horse A', isScratched: false },
      { programNumber: 2, horseName: 'Horse B', isScratched: false },
      { programNumber: 3, horseName: 'Horse C', isScratched: false },
      { programNumber: 4, horseName: 'Horse D', isScratched: false },
      { programNumber: 5, horseName: 'Horse E', isScratched: false },
    ],
    warnings: [],
    errors: [],
  } as unknown as ParsedRace;
}

function createMockScoringResult(): RaceScoringResult {
  return {
    raceNumber: 1,
    scores: [
      {
        programNumber: 3,
        horseName: 'Horse C',
        finalScore: 200,
        rank: 1,
        isScratched: false,
        positiveFactors: ['Top speed figure'],
        negativeFactors: [],
      } as unknown as HorseScoreForAI,
      {
        programNumber: 1,
        horseName: 'Horse A',
        finalScore: 185,
        rank: 2,
        isScratched: false,
        positiveFactors: ['Good form'],
        negativeFactors: [],
      } as unknown as HorseScoreForAI,
      {
        programNumber: 5,
        horseName: 'Horse E',
        finalScore: 170,
        rank: 3,
        isScratched: false,
        positiveFactors: ['Class edge'],
        negativeFactors: [],
      } as unknown as HorseScoreForAI,
      {
        programNumber: 2,
        horseName: 'Horse B',
        finalScore: 160,
        rank: 4,
        isScratched: false,
        positiveFactors: [],
        negativeFactors: ['Dropping in class'],
      } as unknown as HorseScoreForAI,
      {
        programNumber: 4,
        horseName: 'Horse D',
        finalScore: 140,
        rank: 5,
        isScratched: false,
        positiveFactors: [],
        negativeFactors: ['Poor recent form'],
      } as unknown as HorseScoreForAI,
    ],
    confidence: 'HIGH',
  } as unknown as RaceScoringResult;
}

function createMockAnalysis(): AIRaceAnalysis {
  return {
    raceId: 'race-1',
    raceNumber: 1,
    timestamp: new Date().toISOString(),
    processingTimeMs: 1200,
    raceNarrative: 'CONFIRM: Algorithm top pick #3 supported by pace analysis.',
    confidence: 'HIGH',
    bettableRace: true,
    horseInsights: [
      {
        programNumber: 3,
        horseName: 'Horse C',
        projectedFinish: 1,
        valueLabel: 'BEST BET',
        oneLiner: 'Clear speed advantage on speed-favoring track',
        keyStrength: 'Top speed figure',
        keyWeakness: null,
        isContender: true,
        avoidFlag: false,
      },
      {
        programNumber: 1,
        horseName: 'Horse A',
        projectedFinish: 2,
        valueLabel: 'SOLID PLAY',
        oneLiner: 'Consistent runner, should hit the board',
        keyStrength: 'Good form',
        keyWeakness: null,
        isContender: true,
        avoidFlag: false,
      },
      {
        programNumber: 5,
        horseName: 'Horse E',
        projectedFinish: 3,
        valueLabel: 'FAIR PRICE',
        oneLiner: 'Class edge makes him competitive',
        keyStrength: 'Class edge',
        keyWeakness: null,
        isContender: true,
        avoidFlag: false,
      },
      {
        programNumber: 2,
        horseName: 'Horse B',
        projectedFinish: 4,
        valueLabel: 'WATCH ONLY',
        oneLiner: 'Needs to improve off last effort',
        keyStrength: null,
        keyWeakness: 'Dropping in class',
        isContender: false,
        avoidFlag: false,
      },
      {
        programNumber: 4,
        horseName: 'Horse D',
        projectedFinish: 5,
        valueLabel: 'NO CHANCE',
        oneLiner: 'Outclassed in this field',
        keyStrength: null,
        keyWeakness: 'Poor recent form',
        isContender: false,
        avoidFlag: true,
      },
    ],
    topPick: 3,
    valuePlay: 5,
    avoidList: [4],
    vulnerableFavorite: false,
    likelyUpset: false,
    chaoticRace: false,
  };
}

// ============================================================================
// STORAGE TESTS
// ============================================================================

describe('Metrics Storage', () => {
  beforeEach(() => {
    // Reset storage before each test
    resetStorageForTesting();
  });

  it('saveDecisionRecord stores and retrieves correctly', async () => {
    const record = createMockDecisionRecord();

    await saveDecisionRecord(record);
    const retrieved = await getDecisionRecord(record.raceId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.raceId).toBe(record.raceId);
    expect(retrieved?.algorithmTopPick).toBe(record.algorithmTopPick);
    expect(retrieved?.aiTopPick).toBe(record.aiTopPick);
    expect(retrieved?.aiConfidence).toBe(record.aiConfidence);
  });

  it('updateWithResults updates existing record', async () => {
    const record = createMockDecisionRecord();
    await saveDecisionRecord(record);

    const results: RaceResults = {
      winner: 3,
      exacta: [3, 1],
      trifecta: [3, 1, 5],
    };

    await updateWithResults(record.raceId, results);

    const updated = await getDecisionRecord(record.raceId);

    expect(updated?.actualWinner).toBe(3);
    expect(updated?.actualExacta).toEqual([3, 1]);
    expect(updated?.actualTrifecta).toEqual([3, 1, 5]);
    expect(updated?.resultRecorded).toBe(true);
  });

  it('getAllDecisionRecords returns all records', async () => {
    const record1 = createMockDecisionRecord({ raceId: 'TST-2024-01-01-R1' });
    const record2 = createMockDecisionRecord({ raceId: 'TST-2024-01-01-R2', raceNumber: 2 });
    const record3 = createMockDecisionRecord({ raceId: 'TST-2024-01-01-R3', raceNumber: 3 });

    await saveDecisionRecord(record1);
    await saveDecisionRecord(record2);
    await saveDecisionRecord(record3);

    const allRecords = await getAllDecisionRecords();

    expect(allRecords.length).toBe(3);
  });

  it('clearAllRecords removes all records', async () => {
    const record1 = createMockDecisionRecord({ raceId: 'TST-2024-01-01-R1' });
    const record2 = createMockDecisionRecord({ raceId: 'TST-2024-01-01-R2', raceNumber: 2 });

    await saveDecisionRecord(record1);
    await saveDecisionRecord(record2);

    await clearAllRecords();

    const allRecords = await getAllDecisionRecords();
    expect(allRecords.length).toBe(0);
  });
});

// ============================================================================
// CALCULATOR TESTS
// ============================================================================

describe('Metrics Calculator', () => {
  it('calculatePerformanceMetrics handles empty array', () => {
    const metrics = calculatePerformanceMetrics([]);

    expect(metrics.totalRaces).toBe(0);
    expect(metrics.racesWithResults).toBe(0);
    expect(metrics.aiWinRate).toBe(0);
    expect(metrics.algorithmWinRate).toBe(0);
  });

  it('calculatePerformanceMetrics calculates win rates correctly', () => {
    const records: AIDecisionRecord[] = [
      createMockDecisionRecord({
        raceId: 'R1',
        algorithmTopPick: 3,
        aiTopPick: 3,
        actualWinner: 3,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R2',
        algorithmTopPick: 1,
        aiTopPick: 1,
        actualWinner: 2,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R3',
        algorithmTopPick: 5,
        aiTopPick: 5,
        actualWinner: 5,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R4',
        algorithmTopPick: 2,
        aiTopPick: 2,
        actualWinner: 4,
        resultRecorded: true,
      }),
    ];

    const metrics = calculatePerformanceMetrics(records);

    // 2 out of 4 wins = 50%
    expect(metrics.algorithmWins).toBe(2);
    expect(metrics.aiWins).toBe(2);
    expect(metrics.algorithmWinRate).toBe(50);
    expect(metrics.aiWinRate).toBe(50);
  });

  it('calculatePerformanceMetrics handles division by zero', () => {
    // Records with no results
    const records: AIDecisionRecord[] = [
      createMockDecisionRecord({ raceId: 'R1', resultRecorded: false }),
      createMockDecisionRecord({ raceId: 'R2', resultRecorded: false }),
    ];

    const metrics = calculatePerformanceMetrics(records);

    // Should not crash and return 0 for rates
    expect(metrics.racesWithResults).toBe(0);
    expect(metrics.aiWinRate).toBe(0);
    expect(metrics.algorithmWinRate).toBe(0);
    expect(metrics.overrideWinRate).toBe(0);
  });

  it('override analysis segments correctly', () => {
    const records: AIDecisionRecord[] = [
      // Override: AI picked 5, algorithm picked 3, winner was 5 (AI correct)
      createMockDecisionRecord({
        raceId: 'R1',
        algorithmTopPick: 3,
        aiTopPick: 5,
        isOverride: true,
        actualWinner: 5,
        resultRecorded: true,
      }),
      // Override: AI picked 1, algorithm picked 2, winner was 2 (AI wrong)
      createMockDecisionRecord({
        raceId: 'R2',
        algorithmTopPick: 2,
        aiTopPick: 1,
        isOverride: true,
        actualWinner: 2,
        resultRecorded: true,
      }),
      // Confirm: AI agreed with algorithm, winner was the pick
      createMockDecisionRecord({
        raceId: 'R3',
        algorithmTopPick: 4,
        aiTopPick: 4,
        isOverride: false,
        actualWinner: 4,
        resultRecorded: true,
      }),
      // Confirm: AI agreed with algorithm, winner was different
      createMockDecisionRecord({
        raceId: 'R4',
        algorithmTopPick: 6,
        aiTopPick: 6,
        isOverride: false,
        actualWinner: 1,
        resultRecorded: true,
      }),
    ];

    const metrics = calculatePerformanceMetrics(records);

    expect(metrics.totalOverrides).toBe(2);
    expect(metrics.overrideRate).toBe(50); // 2 out of 4
    expect(metrics.overrideWins).toBe(1); // AI correct when overriding once
    expect(metrics.overrideWinRate).toBe(50); // 1 out of 2 overrides won
    expect(metrics.confirmWins).toBe(1); // AI correct when confirming once
    expect(metrics.confirmWinRate).toBe(50); // 1 out of 2 confirms won
  });

  it('exotic hit detection works (exacta box contains actual)', () => {
    const records: AIDecisionRecord[] = [
      createMockDecisionRecord({
        raceId: 'R1',
        exactaHorses: [3, 1, 5, 2],
        trifectaHorses: [3, 1, 5, 2, 4],
        actualExacta: [3, 1],
        actualTrifecta: [3, 1, 5],
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R2',
        exactaHorses: [2, 4, 6, 8],
        trifectaHorses: [2, 4, 6, 8, 1],
        actualExacta: [1, 3], // Not in box
        actualTrifecta: [1, 3, 5], // Not in box
        resultRecorded: true,
      }),
    ];

    const metrics = calculatePerformanceMetrics(records);

    // First race hits all boxes, second race misses all
    expect(metrics.exactaBox2Hits).toBe(1);
    expect(metrics.exactaBox3Hits).toBe(1);
    expect(metrics.exactaBox4Hits).toBe(1);
    expect(metrics.trifectaBox3Hits).toBe(1);
    expect(metrics.trifectaBox4Hits).toBe(1);
    expect(metrics.trifectaBox5Hits).toBe(1);
  });

  it('confidence calibration segments correctly', () => {
    const records: AIDecisionRecord[] = [
      createMockDecisionRecord({
        raceId: 'R1',
        aiConfidence: 'HIGH',
        aiTopPick: 3,
        actualWinner: 3,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R2',
        aiConfidence: 'HIGH',
        aiTopPick: 1,
        actualWinner: 2,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R3',
        aiConfidence: 'MEDIUM',
        aiTopPick: 5,
        actualWinner: 5,
        resultRecorded: true,
      }),
      createMockDecisionRecord({
        raceId: 'R4',
        aiConfidence: 'LOW',
        aiTopPick: 2,
        actualWinner: 4,
        resultRecorded: true,
      }),
    ];

    const metrics = calculatePerformanceMetrics(records);

    expect(metrics.highConfidenceRaces).toBe(2);
    expect(metrics.highConfidenceWinRate).toBe(50); // 1/2
    expect(metrics.mediumConfidenceRaces).toBe(1);
    expect(metrics.mediumConfidenceWinRate).toBe(100); // 1/1
    expect(metrics.lowConfidenceRaces).toBe(1);
    expect(metrics.lowConfidenceWinRate).toBe(0); // 0/1
  });

  it('compareToBaseline calculates differences correctly', () => {
    const metrics: AIPerformanceMetrics = {
      totalRaces: 100,
      racesWithResults: 100,
      algorithmWins: 16,
      algorithmWinRate: 16.0,
      aiWins: 20,
      aiWinRate: 20.0,
      algorithmTop3Hits: 48,
      algorithmTop3Rate: 48.0,
      aiTop3Hits: 55,
      aiTop3Rate: 55.0,
      totalOverrides: 25,
      overrideRate: 25.0,
      overrideWins: 10,
      overrideWinRate: 40.0,
      confirmWins: 10,
      confirmWinRate: 13.3,
      exactaBox2Hits: 10,
      exactaBox3Hits: 20,
      exactaBox4Hits: 40,
      trifectaBox3Hits: 15,
      trifectaBox4Hits: 30,
      trifectaBox5Hits: 45,
      valuePlaysIdentified: 50,
      valuePlayWins: 8,
      valuePlayWinRate: 16.0,
      valuePlayAvgOdds: 6.5,
      highConfidenceRaces: 40,
      highConfidenceWinRate: 30.0,
      mediumConfidenceRaces: 40,
      mediumConfidenceWinRate: 15.0,
      lowConfidenceRaces: 20,
      lowConfidenceWinRate: 5.0,
      tripTroubleBoostWinRate: 25.0,
      paceAdvantageWinRate: 28.0,
      vulnerableFavoriteFadeRate: 65.0,
      dominantFieldWinRate: 35.0,
      competitiveFieldWinRate: 18.0,
      wideOpenFieldWinRate: 10.0,
    };

    const comparison = compareToBaseline(metrics);

    // AI win rate (20%) vs baseline (16.2%) = +3.8%
    expect(comparison.winRateDiff).toBeCloseTo(3.8, 1);
    // AI top-3 (55%) vs baseline (48.6%) = +6.4%
    expect(comparison.top3RateDiff).toBeCloseTo(6.4, 1);
    // AI outperforming if 3+ metrics positive
    expect(comparison.isOutperforming).toBe(true);
  });
});

// ============================================================================
// RECORDER TESTS
// ============================================================================

describe('Decision Recorder', () => {
  it('buildDecisionRecord extracts all fields from AIRaceAnalysis', () => {
    const analysis = createMockAnalysis();
    const scoringResult = createMockScoringResult();
    const race = createMockRace();

    const record = buildDecisionRecord(analysis, scoringResult, race);

    expect(record.raceId).toBe('TST-2024-01-01-R1');
    expect(record.trackCode).toBe('TST');
    expect(record.raceNumber).toBe(1);
    expect(record.fieldSize).toBe(5);
    expect(record.algorithmTopPick).toBe(3);
    expect(record.algorithmTop3).toEqual([3, 1, 5]);
    expect(record.aiTopPick).toBe(3);
    expect(record.aiValuePlay).toBe(5);
    expect(record.aiTop3).toEqual([3, 1, 5]);
    expect(record.aiAvoidList).toEqual([4]);
    expect(record.aiConfidence).toBe('HIGH');
    expect(record.isOverride).toBe(false);
    expect(record.resultRecorded).toBe(false);
  });

  it('buildDecisionRecord detects override correctly', () => {
    const analysis = createMockAnalysis();
    analysis.topPick = 5; // Different from algorithm top pick of 3
    analysis.raceNarrative = 'OVERRIDE: #5 promoted due to trip trouble.';

    const scoringResult = createMockScoringResult();
    const race = createMockRace();

    const record = buildDecisionRecord(analysis, scoringResult, race);

    expect(record.isOverride).toBe(true);
    expect(record.overrideReason).toBe('#5 promoted due to trip trouble');
  });

  it('buildDecisionRecord handles missing fields with defaults', () => {
    const analysis = createMockAnalysis();
    const scoringResult = createMockScoringResult();
    const race = createMockRace();

    // Remove some optional fields
    race.header.trackCode = '';
    race.header.raceDate = '';

    const record = buildDecisionRecord(analysis, scoringResult, race);

    // Should use defaults
    expect(record.trackCode).toBe('UNK');
  });
});

// ============================================================================
// EXPORT TESTS
// ============================================================================

describe('Metrics Export', () => {
  beforeEach(() => {
    resetStorageForTesting();
  });

  it('exportMetricsReport generates valid markdown', async () => {
    // Add some test records
    const record1 = createMockDecisionRecord({
      raceId: 'R1',
      aiConfidence: 'HIGH',
      aiTopPick: 3,
      actualWinner: 3,
      resultRecorded: true,
    });
    const record2 = createMockDecisionRecord({
      raceId: 'R2',
      aiConfidence: 'MEDIUM',
      aiTopPick: 1,
      actualWinner: 2,
      resultRecorded: true,
    });

    await saveDecisionRecord(record1);
    await saveDecisionRecord(record2);

    const report = await exportMetricsReport();

    // Check all sections are present
    expect(report).toContain('# AI Performance Report');
    expect(report).toContain('## Win Rate Comparison');
    expect(report).toContain('## Override Analysis');
    expect(report).toContain('## Exotic Performance');
    expect(report).toContain('## Value Play Performance');
    expect(report).toContain('## Confidence Calibration');
    expect(report).toContain('## Bot Effectiveness');
    expect(report).toContain('## Field Type Performance');
    expect(report).toContain('## Summary');

    // Check it contains data
    expect(report).toContain('Races Analyzed: 2');
    expect(report).toContain('Races with Results: 2');
  });

  it('exportMetricsReport handles empty records', async () => {
    // Ensure we start fresh
    await clearAllRecords();

    const report = await exportMetricsReport();

    expect(report).toContain('# AI Performance Report');
    expect(report).toContain('Races Analyzed: 0');
    expect(report).toContain('Races with Results: 0');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Metrics Integration', () => {
  beforeEach(async () => {
    resetStorageForTesting();
    await clearAllRecords();
  });

  it('full record lifecycle: record -> retrieve -> update -> retrieve', async () => {
    // 1. Record AI decision
    const analysis = createMockAnalysis();
    const scoringResult = createMockScoringResult();
    const race = createMockRace();

    const record = buildDecisionRecord(analysis, scoringResult, race);
    await saveDecisionRecord(record);

    // 2. Retrieve and verify
    const retrieved = await getDecisionRecord(record.raceId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.aiTopPick).toBe(3);
    expect(retrieved?.resultRecorded).toBe(false);

    // 3. Update with results
    const results: RaceResults = {
      winner: 3,
      exacta: [3, 1],
      trifecta: [3, 1, 5],
    };
    await updateWithResults(record.raceId, results);

    // 4. Retrieve and verify results
    const updated = await getDecisionRecord(record.raceId);
    expect(updated?.actualWinner).toBe(3);
    expect(updated?.actualExacta).toEqual([3, 1]);
    expect(updated?.actualTrifecta).toEqual([3, 1, 5]);
    expect(updated?.resultRecorded).toBe(true);
  });

  it('metrics calculation with mixed outcomes', async () => {
    // Create 10 records with mixed outcomes
    const records: AIDecisionRecord[] = [];

    // 3 wins for both (30% each)
    for (let i = 0; i < 3; i++) {
      records.push(
        createMockDecisionRecord({
          raceId: `WIN-${i}`,
          algorithmTopPick: 1,
          aiTopPick: 1,
          actualWinner: 1,
          resultRecorded: true,
        })
      );
    }

    // 2 algorithm wins only
    for (let i = 0; i < 2; i++) {
      records.push(
        createMockDecisionRecord({
          raceId: `ALG-${i}`,
          algorithmTopPick: 2,
          aiTopPick: 3,
          isOverride: true,
          actualWinner: 2,
          resultRecorded: true,
        })
      );
    }

    // 2 AI wins only (overrides)
    for (let i = 0; i < 2; i++) {
      records.push(
        createMockDecisionRecord({
          raceId: `AI-${i}`,
          algorithmTopPick: 4,
          aiTopPick: 5,
          isOverride: true,
          actualWinner: 5,
          resultRecorded: true,
        })
      );
    }

    // 3 no wins
    for (let i = 0; i < 3; i++) {
      records.push(
        createMockDecisionRecord({
          raceId: `LOSS-${i}`,
          algorithmTopPick: 6,
          aiTopPick: 6,
          actualWinner: 7,
          resultRecorded: true,
        })
      );
    }

    // Save all records
    for (const record of records) {
      await saveDecisionRecord(record);
    }

    // Calculate metrics
    const allRecords = await getAllDecisionRecords();
    const metrics = calculatePerformanceMetrics(allRecords);

    // Verify calculations
    expect(metrics.totalRaces).toBe(10);
    expect(metrics.racesWithResults).toBe(10);

    // Algorithm wins: 3 shared + 2 algorithm only = 5
    expect(metrics.algorithmWins).toBe(5);
    expect(metrics.algorithmWinRate).toBe(50);

    // AI wins: 3 shared + 2 AI only = 5
    expect(metrics.aiWins).toBe(5);
    expect(metrics.aiWinRate).toBe(50);

    // Override analysis
    expect(metrics.totalOverrides).toBe(4); // 2 alg wins + 2 AI wins
    expect(metrics.overrideWins).toBe(2); // AI correct when overriding
    expect(metrics.overrideWinRate).toBe(50); // 2/4
  });
});
