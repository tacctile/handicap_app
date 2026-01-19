/**
 * UI Data Flow Integration Tests
 *
 * Tests that scoring results properly reach UI components and that
 * bet recommendations format matches UI expectations.
 *
 * Verifies:
 * - Scoring results reach enhanced betting hook
 * - Bet recommendations format is compatible with UI
 * - Bankroll changes reflect in recommendations
 * - Calibration status is properly exposed to UI
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnhancedBetting, type UseEnhancedBettingInput } from '../../hooks/useEnhancedBetting';
import type { ScoredHorse } from '../../lib/scoring';
import type { RaceHeader } from '../../types/drf';
import type { HorseEntry } from '../../types/drf';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function createMockHorseEntry(programNumber: number): HorseEntry {
  return {
    programNumber,
    horseName: `Horse ${programNumber}`,
    morningLineOdds: `${programNumber * 2}-1`,
    postPosition: programNumber,
    weight: 120,
    jockey: `Jockey ${programNumber}`,
    trainer: `Trainer ${programNumber}`,
    owner: `Owner ${programNumber}`,
    sex: 'C',
    age: 4,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimeSeconds: 3,
    lifetimeThirds: 2,
    lifetimeEarnings: 50000,
    lastRaceDistance: '6f',
    lastRaceTrack: 'CD',
    pastPerformances: [],
  } as HorseEntry;
}

function createMockScoredHorses(count: number = 8): ScoredHorse[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    horse: createMockHorseEntry(i + 1),
    score: {
      baseScore: 250 - i * 15,
      overlayScore: 0,
      totalScore: 250 - i * 15,
      isScratched: false,
      overlayResult: {
        totalAdjustment: 0,
        paceAdjustment: 0,
        formAdjustment: 0,
        tripAdjustment: 0,
        classAdjustment: 0,
        connectionAdjustment: 0,
        distanceSurfaceAdjustment: 0,
        tacticalAdjustment: 0,
      },
      breakdown: {
        connections: { total: 10, trainer: 5, jockey: 4, partnershipBonus: 1, reasoning: '' },
        postPosition: { total: 5, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
        speedClass: {
          total: 80,
          speedScore: 60,
          classScore: 20,
          bestFigure: 90,
          classMovement: 'level',
          reasoning: '',
        },
        form: {
          total: 30,
          recentFormScore: 20,
          layoffScore: 5,
          consistencyBonus: 5,
          formTrend: 'up',
          reasoning: '',
          wonLastOut: false,
          won2OfLast3: false,
        },
        equipment: { total: 0, hasChanges: false, reasoning: '' },
        pace: { total: 15, runningStyle: 'stalker', paceFit: 'good', reasoning: '' },
        odds: { total: 5, oddsValue: 4, oddsSource: 'morning_line', tier: 'FAIR', reasoning: '' },
        distanceSurface: {
          total: 10,
          turfScore: 0,
          wetScore: 0,
          distanceScore: 10,
          turfWinRate: 0,
          wetWinRate: 0,
          distanceWinRate: 0.25,
          reasoning: [],
        },
        trainerPatterns: { total: 5, matchedPatterns: [], reasoning: [] },
        comboPatterns: { total: 0, detectedCombos: [], intentScore: 0, reasoning: [] },
        trackSpecialist: {
          total: 0,
          trackWinRate: 0,
          trackITMRate: 0,
          isSpecialist: false,
          reasoning: '',
        },
        trainerSurfaceDistance: {
          total: 0,
          matchedCategory: null,
          trainerWinPercent: 0,
          wetTrackWinPercent: 0,
          wetBonusApplied: false,
          reasoning: '',
        },
        weightAnalysis: {
          total: 0,
          currentWeight: 120,
          lastRaceWeight: null,
          weightChange: null,
          significantDrop: false,
          significantGain: false,
          showWeightGainFlag: false,
          reasoning: '',
        },
        sexAnalysis: {
          total: 0,
          horseSex: 'C',
          isFemale: false,
          isRestrictedRace: false,
          isMixedRace: true,
          isFirstTimeFacingMales: false,
          flags: [],
          reasoning: '',
        },
      },
    },
  })) as ScoredHorse[];
}

function createMockRaceHeader(): RaceHeader {
  return {
    trackCode: 'CD',
    raceNumber: 1,
    raceDate: '2024-01-15',
    surface: 'dirt',
    distance: '6f',
    classification: 'allowance',
    purse: 50000,
    ageRestriction: '3yo+',
    fieldSize: 8,
    isAbout: false,
    furlongs: 6,
    isRoute: false,
  } as RaceHeader;
}

// ============================================================================
// ENHANCED BETTING HOOK TESTS
// ============================================================================

describe('useEnhancedBetting Hook Integration', () => {
  it('should return enhanced horse data with model probabilities', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.enhancedHorses.length).toBe(8);

    // Verify each horse has required fields for UI
    for (const horse of result.current.enhancedHorses) {
      expect(horse.programNumber).toBeGreaterThan(0);
      expect(horse.horseName).toBeDefined();
      expect(horse.baseScore).toBeGreaterThan(0);
      expect(horse.modelProbability).toBeGreaterThan(0);
      expect(horse.modelProbability).toBeLessThanOrEqual(1);
      expect(horse.confidencePercent).toBeGreaterThan(0);
      expect(horse.confidencePercent).toBeLessThanOrEqual(100);
      expect(horse.trueOverlayPercent).toBeDefined();
      expect(horse.expectedValue).toBeDefined();
      expect(horse.valueClass).toBeDefined();
    }
  });

  it('should return pipeline output', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.pipelineOutput).not.toBeNull();
    expect(result.current.pipelineOutput!.horses.length).toBe(8);
  });

  it('should expose calibration status', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(typeof result.current.calibrationActive).toBe('boolean');
  });

  it('should handle missing scored horses', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: null,
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.error).toBe('No scored horses provided');
    expect(result.current.enhancedHorses.length).toBe(0);
  });

  it('should handle missing race header', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: null,
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.error).toBe('No race header provided');
  });

  it('should provide field metrics', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.fieldMetrics.fieldSize).toBe(8);
    expect(result.current.fieldMetrics.overround).toBeGreaterThan(1);
    expect(result.current.fieldMetrics.takeoutPercent).toBeGreaterThan(0);
  });
});

// ============================================================================
// BANKROLL INTEGRATION TESTS
// ============================================================================

describe('Bankroll Integration', () => {
  it('should initialize with default bankroll', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.bankroll).toBe(250); // Default bankroll
  });

  it('should initialize with custom bankroll', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 1000,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.bankroll).toBe(1000);
  });

  it('should allow setting bankroll', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    act(() => {
      result.current.setBankroll(500);
    });

    expect(result.current.bankroll).toBe(500);
  });

  it('should expose bankroll state', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 500,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.bankrollState).toBeDefined();
    expect(result.current.bankrollState.currentBankroll).toBe(500);
    expect(result.current.bankrollState.startingBankroll).toBe(500);
  });

  it('should allow resetting session', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 500,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Change bankroll
    act(() => {
      result.current.setBankroll(300);
    });

    expect(result.current.bankroll).toBe(300);

    // Reset to new amount
    act(() => {
      result.current.resetSession(1000);
    });

    expect(result.current.bankroll).toBe(1000);
  });
});

// ============================================================================
// RECOMMENDATIONS FORMAT TESTS
// ============================================================================

describe('Recommendations Format for UI', () => {
  it('should generate recommendations with expected format', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 500,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    const recommendations = result.current.recommendations;

    if (recommendations && recommendations.recommendations.length > 0) {
      for (const rec of recommendations.recommendations) {
        // Required fields for UI display
        expect(rec.programNumber).toBeGreaterThan(0);
        expect(rec.betType).toBeDefined();
        expect(['WIN', 'PLACE', 'SHOW']).toContain(rec.betType);
        expect(rec.suggestedAmount).toBeGreaterThanOrEqual(0);
        expect(rec.odds).toBeGreaterThan(0);
        expect(rec.probability).toBeGreaterThan(0);
        expect(rec.probability).toBeLessThanOrEqual(1);
        expect(rec.expectedValue).toBeDefined();
        expect(rec.confidence).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(rec.confidence);
        expect(rec.reasoning).toBeDefined();
      }
    }
  });

  it('should include total suggested bets', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 500,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.recommendations?.totalSuggestedBets).toBeDefined();
    expect(typeof result.current.recommendations?.totalSuggestedBets).toBe('number');
  });

  it('should include total exposure percentage', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      initialBankroll: 500,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.recommendations?.totalExposure).toBeDefined();
    expect(result.current.recommendations?.totalExposure).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// DATA FLOW VERIFICATION TESTS
// ============================================================================

describe('Scoring Results Reach UI Components', () => {
  it('should preserve horse data through pipeline', () => {
    const scoredHorses = createMockScoredHorses();
    const input: UseEnhancedBettingInput = {
      scoredHorses,
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Verify all horses made it through
    expect(result.current.enhancedHorses.length).toBe(scoredHorses.length);

    // Verify data integrity
    for (let i = 0; i < scoredHorses.length; i++) {
      const original = scoredHorses[i]!;
      const enhanced = result.current.enhancedHorses.find(
        (h) => h.programNumber === original.horse.programNumber
      );

      expect(enhanced).toBeDefined();
      expect(enhanced!.baseScore).toBe(original.score.baseScore);
      expect(enhanced!.horseName).toBe(original.horse.horseName);
    }
  });

  it('should use softmax probabilities (not linear)', () => {
    const scoredHorses = createMockScoredHorses();
    const input: UseEnhancedBettingInput = {
      scoredHorses,
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Calculate what linear probabilities would be
    const totalScore = scoredHorses.reduce((sum, h) => sum + h.score.baseScore, 0);
    const linearProbs = scoredHorses.map((h) => h.score.baseScore / totalScore);

    // Enhanced horses should NOT have linear probabilities
    let isDifferent = false;
    for (let i = 0; i < scoredHorses.length; i++) {
      const enhanced = result.current.enhancedHorses.find(
        (h) => h.programNumber === scoredHorses[i]!.horse.programNumber
      );
      if (enhanced && Math.abs(enhanced.modelProbability - linearProbs[i]!) > 0.01) {
        isDifferent = true;
        break;
      }
    }

    expect(isDifferent).toBe(true);
  });

  it('should filter scratched horses', () => {
    const scoredHorses = createMockScoredHorses();
    // Mark horse 3 as scratched
    scoredHorses[2]!.score.isScratched = true;

    const input: UseEnhancedBettingInput = {
      scoredHorses,
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Should have one less horse
    expect(result.current.enhancedHorses.length).toBe(7);

    // Horse 3 should not be present
    const horse3 = result.current.enhancedHorses.find((h) => h.programNumber === 3);
    expect(horse3).toBeUndefined();
  });

  it('should filter horses via isScratched callback', () => {
    const scoredHorses = createMockScoredHorses();

    const input: UseEnhancedBettingInput = {
      scoredHorses,
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
      isScratched: (index) => index === 4, // Horse at index 4 (program 5) is scratched
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Should have one less horse
    expect(result.current.enhancedHorses.length).toBe(7);

    // Horse 5 should not be present
    const horse5 = result.current.enhancedHorses.find((h) => h.programNumber === 5);
    expect(horse5).toBeUndefined();
  });
});

// ============================================================================
// CONFIG PERSISTENCE TESTS
// ============================================================================

describe('Betting Config Persistence', () => {
  it('should expose bet sizing config', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    expect(result.current.config).toBeDefined();
    expect(result.current.config.minBetAmount).toBeDefined();
    expect(result.current.config.maxBetPercent).toBeDefined();
  });

  it('should allow updating config', () => {
    const input: UseEnhancedBettingInput = {
      scoredHorses: createMockScoredHorses(),
      raceHeader: createMockRaceHeader(),
      raceNumber: 1,
    };

    const { result } = renderHook(() => useEnhancedBetting(input));

    // Verify initial value before updating
    expect(result.current.config.minBetAmount).toBeDefined();

    act(() => {
      result.current.updateConfig({ minBetAmount: 10 });
    });

    expect(result.current.config.minBetAmount).toBe(10);
  });
});
