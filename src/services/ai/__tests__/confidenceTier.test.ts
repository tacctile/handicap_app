/**
 * Tests for Value-Based Confidence Tier System
 *
 * Tests the rewired confidence tier assignment:
 * - SOLID favorite races route to MINIMAL tier (no value edge)
 * - HIGH/MEDIUM/LOW tiers require identified value horse
 * - Deterministic tier assignment (same inputs = same tier)
 */

import { describe, it, expect } from 'vitest';
import {
  identifyValueHorse,
  selectTemplate,
  calculateConfidenceScore,
  buildTicketConstruction,
} from '../index';
import type { AggregatedSignals, MultiBotRawResults, VulnerableFavoriteAnalysis } from '../types';

// ============================================================================
// MOCK DATA BUILDERS
// ============================================================================

function createMockAggregatedSignals(
  horses: Array<{
    programNumber: number;
    horseName: string;
    algorithmRank: number;
    algorithmScore: number;
    tripTroubleBoost?: number;
    paceAdvantage?: number;
    paceEdgeReason?: string | null;
    isVulnerable?: boolean;
    vulnerabilityFlags?: string[];
  }>
): AggregatedSignals[] {
  return horses.map((h) => ({
    programNumber: h.programNumber,
    horseName: h.horseName,
    algorithmRank: h.algorithmRank,
    algorithmScore: h.algorithmScore,
    tripTroubleBoost: h.tripTroubleBoost ?? 0,
    hiddenAbility: h.tripTroubleBoost && h.tripTroubleBoost > 0 ? 'Trip trouble detected' : null,
    tripTroubleFlagged: (h.tripTroubleBoost ?? 0) > 0,
    paceAdvantage: h.paceAdvantage ?? 0,
    paceEdgeReason: h.paceEdgeReason ?? null,
    paceAdvantageFlagged: (h.paceAdvantage ?? 0) > 0,
    isVulnerable: h.isVulnerable ?? false,
    vulnerabilityFlags: h.vulnerabilityFlags ?? [],
    classification: 'A',
    keyCandidate: h.algorithmRank === 1,
    spreadOnly: false,
    classDropBoost: 0,
    classDropFlagged: false,
    classDropReason: null,
    totalAdjustment: (h.tripTroubleBoost ?? 0) + (h.paceAdvantage ?? 0),
    adjustedRank: h.algorithmRank,
    signalCount: ((h.tripTroubleBoost ?? 0) > 0 ? 1 : 0) + ((h.paceAdvantage ?? 0) > 0 ? 1 : 0),
    conflictingSignals: false,
    overrideReasons: [],
  }));
}

function createMockRawResults(options: {
  tripTroubleHorses?: Array<{
    programNumber: number;
    horseName: string;
    issue: string;
    maskedAbility: boolean;
  }>;
  paceScenario?: {
    paceProjection: 'HOT' | 'MODERATE' | 'SLOW';
    loneSpeedException: boolean;
    speedDuelLikely: boolean;
  };
  vulnerableFavorite?: {
    isVulnerable: boolean;
    reasons: string[];
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  fieldSpread?: {
    fieldType: string;
    topTierCount: number;
  };
}): MultiBotRawResults {
  return {
    tripTrouble: options.tripTroubleHorses
      ? { horsesWithTripTrouble: options.tripTroubleHorses }
      : null,
    paceScenario: options.paceScenario
      ? {
          advantagedStyles: ['E'],
          disadvantagedStyles: ['C'],
          paceProjection: options.paceScenario.paceProjection,
          loneSpeedException: options.paceScenario.loneSpeedException,
          speedDuelLikely: options.paceScenario.speedDuelLikely,
        }
      : null,
    vulnerableFavorite: options.vulnerableFavorite ?? null,
    fieldSpread: options.fieldSpread
      ? {
          fieldType: options.fieldSpread.fieldType as
            | 'DOMINANT'
            | 'SEPARATED'
            | 'TIGHT'
            | 'WIDE_OPEN',
          topTierCount: options.fieldSpread.topTierCount,
          recommendedSpread: 'NARROW' as 'NARROW' | 'MEDIUM' | 'WIDE',
        }
      : null,
    classDrop: null,
  };
}

// ============================================================================
// TEST: identifyValueHorse
// ============================================================================

describe('identifyValueHorse', () => {
  it('should return identified=false when no bot signals value horse', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const rawResults = createMockRawResults({});

    const result = identifyValueHorse(signals, rawResults, 'SOLID');

    expect(result.identified).toBe(false);
    expect(result.programNumber).toBeNull();
    expect(result.signalStrength).toBe('NONE');
  });

  // ============================================================================
  // CRITICAL FIX TESTS: For SOLID favorites, require 2+ bots OR strength >= 50
  // Single-bot weak signals should NOT identify a value horse
  // ============================================================================

  it('should REJECT single-bot trip trouble for SOLID favorite (weak signal)', () => {
    // This test verifies the critical fix: single-bot signals should NOT
    // identify a value horse for SOLID favorites.
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Trip Horse',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
      },
    ]);

    const rawResults = createMockRawResults({
      tripTroubleHorses: [
        {
          programNumber: 2,
          horseName: 'Trip Horse',
          issue: 'Blocked in last 2 races - multiple troubled trips',
          maskedAbility: true,
        },
      ],
    });

    const result = identifyValueHorse(signals, rawResults, 'SOLID');

    // For SOLID favorites, single-bot signals (strength 30) are REJECTED
    expect(result.identified).toBe(false);
    expect(result.programNumber).toBeNull();
    expect(result.reasoning).toContain('SOLID favorite');
    expect(result.reasoning).toContain('Weak value signal rejected');
  });

  it('should ACCEPT trip trouble for VULNERABLE favorite (any signal is fine)', () => {
    // For VULNERABLE favorites, single-bot signals ARE accepted because
    // the favorite is already in question
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Trip Horse',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
      },
    ]);

    const rawResults = createMockRawResults({
      tripTroubleHorses: [
        {
          programNumber: 2,
          horseName: 'Trip Horse',
          issue: 'Blocked in last 2 races - multiple troubled trips',
          maskedAbility: true,
        },
      ],
    });

    const result = identifyValueHorse(signals, rawResults, 'VULNERABLE');

    // For VULNERABLE favorites, trip trouble IS identified
    expect(result.identified).toBe(true);
    expect(result.programNumber).toBe(2);
    expect(result.horseName).toBe('Trip Horse');
    expect(result.sources).toContain('TRIP_TROUBLE');
  });

  it('should REJECT lone speed for SOLID favorite (single bot, strength 35 < 50)', () => {
    // Lone speed has strength 35, which is below the 50 threshold for SOLID favorites
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Lone Speed',
        algorithmRank: 2,
        algorithmScore: 180,
        paceAdvantage: 2,
        paceEdgeReason: 'Lone speed with no pressure',
      },
    ]);

    const rawResults = createMockRawResults({
      paceScenario: {
        paceProjection: 'SLOW',
        loneSpeedException: true,
        speedDuelLikely: false,
      },
    });

    const result = identifyValueHorse(signals, rawResults, 'SOLID');

    // Single bot (pace advantage) with strength 35 < 50 threshold - REJECTED
    expect(result.identified).toBe(false);
    expect(result.reasoning).toContain('SOLID favorite');
  });

  it('should ACCEPT lone speed for VULNERABLE favorite', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Lone Speed',
        algorithmRank: 2,
        algorithmScore: 180,
        paceAdvantage: 2,
        paceEdgeReason: 'Lone speed with no pressure',
      },
    ]);

    const rawResults = createMockRawResults({
      paceScenario: {
        paceProjection: 'SLOW',
        loneSpeedException: true,
        speedDuelLikely: false,
      },
    });

    const result = identifyValueHorse(signals, rawResults, 'VULNERABLE');

    // For VULNERABLE favorites, single-bot signals ARE accepted
    expect(result.identified).toBe(true);
    expect(result.sources).toContain('PACE_ADVANTAGE');
  });

  it('should ACCEPT value horse for SOLID favorite when 2+ bots converge', () => {
    // This tests the "strong evidence" case: 2+ bots converge on same horse
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Value Horse',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
        paceAdvantage: 2,
        paceEdgeReason: 'Lone speed advantage',
      },
    ]);

    const rawResults = createMockRawResults({
      tripTroubleHorses: [
        {
          programNumber: 2,
          horseName: 'Value Horse',
          issue: 'Blocked in last 2 races - multiple troubled trips',
          maskedAbility: true,
        },
      ],
      paceScenario: {
        paceProjection: 'SLOW',
        loneSpeedException: true,
        speedDuelLikely: false,
      },
    });

    const result = identifyValueHorse(signals, rawResults, 'SOLID');

    // 2+ bots converge on #2 → value horse IS identified even for SOLID favorite
    expect(result.identified).toBe(true);
    expect(result.programNumber).toBe(2);
    expect(result.botConvergenceCount).toBeGreaterThanOrEqual(2);
    expect(['STRONG', 'VERY_STRONG']).toContain(result.signalStrength);
  });

  it('should identify algorithm rank 2 as value when favorite is vulnerable', () => {
    const signals = createMockAggregatedSignals([
      {
        programNumber: 1,
        horseName: 'Vulnerable Fav',
        algorithmRank: 1,
        algorithmScore: 200,
        isVulnerable: true,
      },
      { programNumber: 2, horseName: 'Beneficiary', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: true,
        reasons: ['Class rise', 'Poor form'],
        confidence: 'HIGH',
      },
    });

    const result = identifyValueHorse(signals, rawResults, 'VULNERABLE');

    expect(result.identified).toBe(true);
    expect(result.programNumber).toBe(2);
    expect(result.sources).toContain('VULNERABLE_FAVORITE');
  });

  it('should return VERY_STRONG signal when multiple bots converge', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Value Horse',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
        paceAdvantage: 2,
        paceEdgeReason: 'Lone speed advantage',
      },
    ]);

    const rawResults = createMockRawResults({
      tripTroubleHorses: [
        {
          programNumber: 2,
          horseName: 'Value Horse',
          issue: 'Blocked in last 2 races',
          maskedAbility: true,
        },
      ],
      paceScenario: {
        paceProjection: 'SLOW',
        loneSpeedException: true,
        speedDuelLikely: false,
      },
      vulnerableFavorite: {
        isVulnerable: true,
        reasons: ['Class rise'],
        confidence: 'HIGH',
      },
    });

    const result = identifyValueHorse(signals, rawResults, 'VULNERABLE');

    expect(result.identified).toBe(true);
    expect(result.botConvergenceCount).toBeGreaterThanOrEqual(2);
    // Signal strength should be STRONG or VERY_STRONG with multiple bots
    expect(['STRONG', 'VERY_STRONG']).toContain(result.signalStrength);
  });
});

// ============================================================================
// TEST: selectTemplate
// ============================================================================

describe('selectTemplate', () => {
  it('should return PASS template for SOLID favorite without value horse', () => {
    const valueHorse = {
      identified: false,
      programNumber: null,
      horseName: null,
      sources: [],
      signalStrength: 'NONE' as const,
      angle: null,
      valueOdds: null,
      botConvergenceCount: 0,
      reasoning: 'No value horse identified',
    };

    const [template, reason] = selectTemplate('COMPETITIVE', 'SOLID', null, valueHorse);

    expect(template).toBe('PASS');
    expect(reason).toContain('no identified value horse');
  });

  it('should return Template A for SOLID favorite WITH value horse', () => {
    const valueHorse = {
      identified: true,
      programNumber: 3,
      horseName: 'Value Play',
      sources: ['TRIP_TROUBLE' as const],
      signalStrength: 'STRONG' as const,
      angle: 'Trip trouble - hidden ability',
      valueOdds: 8,
      botConvergenceCount: 1,
      reasoning: 'Trip trouble detected',
    };

    const [template, _reason] = selectTemplate('COMPETITIVE', 'SOLID', null, valueHorse);

    expect(template).toBe('A');
  });

  it('should return Template B for VULNERABLE favorite', () => {
    const vulnerableFav: VulnerableFavoriteAnalysis = {
      isVulnerable: true,
      reasons: ['Class rise', 'Poor form'],
      confidence: 'HIGH',
    };

    const [template, _reason] = selectTemplate('COMPETITIVE', 'VULNERABLE', vulnerableFav);

    expect(template).toBe('B');
  });

  it('should return Template C for WIDE_OPEN race type', () => {
    const [template, _reason] = selectTemplate('WIDE_OPEN', 'SOLID', null);

    expect(template).toBe('C');
  });
});

// ============================================================================
// TEST: calculateConfidenceScore
// ============================================================================

describe('calculateConfidenceScore', () => {
  it('should return MINIMAL tier score (0-39) for SOLID favorite without value horse', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const valueHorse = {
      identified: false,
      programNumber: null,
      horseName: null,
      sources: [],
      signalStrength: 'NONE' as const,
      angle: null,
      valueOdds: null,
      botConvergenceCount: 0,
      reasoning: 'No value horse',
    };

    const score = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'SOLID');

    expect(score).toBeLessThan(40); // MINIMAL tier
  });

  it('should return HIGH tier score (80+) for VERY_STRONG value signal', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Value', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const valueHorse = {
      identified: true,
      programNumber: 2,
      horseName: 'Value',
      sources: ['MULTIPLE' as const, 'TRIP_TROUBLE' as const, 'PACE_ADVANTAGE' as const],
      signalStrength: 'VERY_STRONG' as const,
      angle: 'Multiple bots converge',
      valueOdds: 8,
      botConvergenceCount: 3,
      reasoning: '3 bots identify value',
    };

    const score = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'SOLID');

    expect(score).toBeGreaterThanOrEqual(80); // HIGH tier
  });

  it('should return MEDIUM tier score (60-79) for MODERATE value signal', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Value', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const valueHorse = {
      identified: true,
      programNumber: 2,
      horseName: 'Value',
      sources: ['TRIP_TROUBLE' as const],
      signalStrength: 'MODERATE' as const,
      angle: 'Single bot signal',
      valueOdds: 8,
      botConvergenceCount: 1,
      reasoning: '1 bot identifies value',
    };

    const score = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'SOLID');

    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThan(80); // MEDIUM tier
  });

  it('should return LOW tier score (40-59) for WEAK value signal', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Value', algorithmRank: 2, algorithmScore: 180 },
    ]);

    const valueHorse = {
      identified: true,
      programNumber: 2,
      horseName: 'Value',
      sources: ['TRIP_TROUBLE' as const],
      signalStrength: 'WEAK' as const,
      angle: 'Weak signal',
      valueOdds: 8,
      botConvergenceCount: 1,
      reasoning: 'Weak value signal',
    };

    const score = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'SOLID');

    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(60); // LOW tier
  });

  it('should be deterministic - same inputs produce same score', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Favorite', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Value',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
      },
    ]);

    const valueHorse = {
      identified: true,
      programNumber: 2,
      horseName: 'Value',
      sources: ['TRIP_TROUBLE' as const],
      signalStrength: 'STRONG' as const,
      angle: 'Trip trouble',
      valueOdds: 8,
      botConvergenceCount: 2,
      reasoning: '2 bots',
    };

    const score1 = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'VULNERABLE');
    const score2 = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'VULNERABLE');
    const score3 = calculateConfidenceScore('COMPETITIVE', null, signals, valueHorse, 'VULNERABLE');

    expect(score1).toBe(score2);
    expect(score2).toBe(score3);
  });
});

// ============================================================================
// TEST: buildTicketConstruction (Integration)
// ============================================================================

describe('buildTicketConstruction', () => {
  it('should set template to PASS for SOLID favorite without value horse (Scenario A)', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Solid Fav', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 140 },
    ]);

    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: false,
        reasons: [],
        confidence: 'LOW',
      },
      fieldSpread: {
        fieldType: 'SEPARATED',
        topTierCount: 2,
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    expect(result.template).toBe('PASS');
    expect(result.favoriteStatus).toBe('SOLID');
    expect(result.valueHorse.identified).toBe(false);
    expect(result.confidenceScore).toBeLessThan(40); // MINIMAL tier
    expect(result.verdict.action).toBe('PASS');
  });

  it('should set template to B for VULNERABLE favorite with value horse (Scenario B)', () => {
    const signals = createMockAggregatedSignals([
      {
        programNumber: 1,
        horseName: 'Vuln Fav',
        algorithmRank: 1,
        algorithmScore: 200,
        isVulnerable: true,
      },
      { programNumber: 2, horseName: 'Beneficiary', algorithmRank: 2, algorithmScore: 180 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      {
        programNumber: 4,
        horseName: 'Pace Horse',
        algorithmRank: 4,
        algorithmScore: 140,
        paceAdvantage: 2,
        paceEdgeReason: 'Pace advantage at 8-1 odds',
      },
    ]);

    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: true,
        reasons: ['Class rise', 'Poor form'],
        confidence: 'HIGH',
      },
      paceScenario: {
        paceProjection: 'HOT',
        loneSpeedException: false,
        speedDuelLikely: true,
      },
      fieldSpread: {
        fieldType: 'COMPETITIVE',
        topTierCount: 3,
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    expect(result.template).toBe('B');
    expect(result.favoriteStatus).toBe('VULNERABLE');
    expect(result.valueHorse.identified).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(40); // Not MINIMAL
    expect(result.verdict.action).toBe('BET');
  });

  it('should set template to PASS for VULNERABLE favorite WITHOUT clear alternative (Scenario C)', () => {
    const signals = createMockAggregatedSignals([
      {
        programNumber: 1,
        horseName: 'Vuln Fav',
        algorithmRank: 1,
        algorithmScore: 200,
        isVulnerable: true,
      },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 140 },
    ]);

    // Vulnerable favorite but NO bot signals identify a specific value horse
    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: true,
        reasons: ['Questionable form'], // Only 1 flag - not enough for VULNERABLE status
        confidence: 'LOW',
      },
      fieldSpread: {
        fieldType: 'SEPARATED',
        topTierCount: 2,
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    // With only 1 vulnerability flag and LOW confidence, favorite is SOLID
    expect(result.favoriteStatus).toBe('SOLID');
    expect(result.template).toBe('PASS'); // Routes to MINIMAL
  });

  it('should set template to C for WIDE_OPEN field (Scenario D)', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'First', algorithmRank: 1, algorithmScore: 175 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 172 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 170 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 168 },
      { programNumber: 5, horseName: 'Fifth', algorithmRank: 5, algorithmScore: 165 },
    ]);

    const rawResults = createMockRawResults({
      fieldSpread: {
        fieldType: 'WIDE_OPEN',
        topTierCount: 5,
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    expect(result.template).toBe('C');
    expect(result.raceType).toBe('WIDE_OPEN');
  });

  it('should produce deterministic results (Scenario E)', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'First', algorithmRank: 1, algorithmScore: 200 },
      {
        programNumber: 2,
        horseName: 'Second',
        algorithmRank: 2,
        algorithmScore: 180,
        tripTroubleBoost: 2,
      },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 140 },
    ]);

    const rawResults = createMockRawResults({
      tripTroubleHorses: [
        {
          programNumber: 2,
          horseName: 'Second',
          issue: 'Blocked in last 2 races',
          maskedAbility: true,
        },
      ],
      vulnerableFavorite: {
        isVulnerable: true,
        reasons: ['Class rise', 'Poor form'],
        confidence: 'HIGH',
      },
    });

    const result1 = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );
    const result2 = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    expect(result1.template).toBe(result2.template);
    expect(result1.confidenceScore).toBe(result2.confidenceScore);
    expect(result1.valueHorse.identified).toBe(result2.valueHorse.identified);
    expect(result1.valueHorse.programNumber).toBe(result2.valueHorse.programNumber);
  });

  it('should still show algorithm picks for MINIMAL tier races', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Top Pick', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 140 },
    ]);

    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: false,
        reasons: [],
        confidence: 'LOW',
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    // PASS template but algorithmTop4 should still be populated
    expect(result.template).toBe('PASS');
    expect(result.algorithmTop4).toHaveLength(4);
    expect(result.algorithmTop4[0]).toBe(1); // Top pick
    expect(result.algorithmTop4[1]).toBe(2);
    expect(result.algorithmTop4[2]).toBe(3);
    expect(result.algorithmTop4[3]).toBe(4);
  });

  it('should have empty exacta/trifecta for PASS template', () => {
    const signals = createMockAggregatedSignals([
      { programNumber: 1, horseName: 'Top Pick', algorithmRank: 1, algorithmScore: 200 },
      { programNumber: 2, horseName: 'Second', algorithmRank: 2, algorithmScore: 180 },
      { programNumber: 3, horseName: 'Third', algorithmRank: 3, algorithmScore: 160 },
      { programNumber: 4, horseName: 'Fourth', algorithmRank: 4, algorithmScore: 140 },
    ]);

    const rawResults = createMockRawResults({
      vulnerableFavorite: {
        isVulnerable: false,
        reasons: [],
        confidence: 'LOW',
      },
    });

    const result = buildTicketConstruction(
      signals,
      rawResults.vulnerableFavorite,
      rawResults.fieldSpread,
      rawResults
    );

    expect(result.template).toBe('PASS');
    expect(result.exacta.winPosition).toHaveLength(0);
    expect(result.exacta.placePosition).toHaveLength(0);
    expect(result.exacta.combinations).toBe(0);
    expect(result.trifecta.winPosition).toHaveLength(0);
    expect(result.trifecta.placePosition).toHaveLength(0);
    expect(result.trifecta.showPosition).toHaveLength(0);
    expect(result.trifecta.combinations).toBe(0);
  });
});
