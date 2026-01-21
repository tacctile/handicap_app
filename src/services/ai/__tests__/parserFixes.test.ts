/**
 * Tests for AI Bot Parser Fixes
 *
 * Verifies that the parsers correctly handle the actual JSON output
 * from the prompts (not the legacy expected schema).
 */

import { describe, it, expect } from 'vitest';
import {
  parseTripTroubleResponse,
  parsePaceScenarioResponse,
  parseVulnerableFavoriteResponse,
  parseFieldSpreadResponse,
} from '../gemini';

describe('Parser Fixes - Handling Actual Prompt Output', () => {
  describe('parseTripTroubleResponse', () => {
    it('should parse response with troubledHorses (actual prompt output)', () => {
      // This is what the actual prompt produces
      const promptOutput = JSON.stringify({
        troubledHorses: [
          {
            programNumber: 3,
            horseName: 'BODEGAS',
            troubledRaceCount: 2,
            hiddenAbilityEstimate: '+5-8 Beyer points masked',
            tripIssues: [
              { race: '2024-12-15', issue: 'Blocked 5-wide on turn' },
              { race: '2024-11-28', issue: 'Stumbled at start' },
            ],
            recommendation: 'Consider upgrade due to masked ability',
          },
        ],
      });

      const result = parseTripTroubleResponse(promptOutput);

      expect(result.horsesWithTripTrouble).toHaveLength(1);
      expect(result.horsesWithTripTrouble[0].programNumber).toBe(3);
      expect(result.horsesWithTripTrouble[0].horseName).toBe('BODEGAS');
      expect(result.horsesWithTripTrouble[0].maskedAbility).toBe(true);
      expect(result.horsesWithTripTrouble[0].issue).toContain('Blocked 5-wide on turn');
    });

    it('should handle empty troubledHorses array', () => {
      const promptOutput = JSON.stringify({
        troubledHorses: [],
      });

      const result = parseTripTroubleResponse(promptOutput);

      expect(result.horsesWithTripTrouble).toHaveLength(0);
    });

    it('should still support legacy horsesWithTripTrouble format', () => {
      const legacyOutput = JSON.stringify({
        horsesWithTripTrouble: [
          {
            programNumber: 5,
            horseName: 'LEGACY HORSE',
            issue: 'Blocked on rail',
            maskedAbility: true,
          },
        ],
      });

      const result = parseTripTroubleResponse(legacyOutput);

      expect(result.horsesWithTripTrouble).toHaveLength(1);
      expect(result.horsesWithTripTrouble[0].programNumber).toBe(5);
      expect(result.horsesWithTripTrouble[0].issue).toBe('Blocked on rail');
    });

    it('should return empty array if no horses field present', () => {
      const emptyOutput = JSON.stringify({
        otherField: 'value',
      });

      const result = parseTripTroubleResponse(emptyOutput);

      expect(result.horsesWithTripTrouble).toHaveLength(0);
    });
  });

  describe('parsePaceScenarioResponse', () => {
    it('should parse LONE_SPEED as HOT pace projection', () => {
      const promptOutput = JSON.stringify({
        paceProjection: 'LONE_SPEED',
        earlySpeedHorses: [3, 5],
        likelyLeader: 3,
        speedDuelLikely: false,
        paceCollapseRisk: 'LOW',
        beneficiaries: [
          {
            programNumber: 3,
            horseName: 'BODEGAS',
            advantage: 'Lone speed advantage',
            edgeStrength: 'STRONG',
          },
        ],
        loneSpeedException: true,
      });

      const result = parsePaceScenarioResponse(promptOutput);

      expect(result.paceProjection).toBe('HOT');
      expect(result.loneSpeedException).toBe(true);
      expect(result.speedDuelLikely).toBe(false);
      expect(result.advantagedStyles).toContain('Lone speed advantage');
    });

    it('should parse SPEED_DUEL as HOT pace projection', () => {
      const promptOutput = JSON.stringify({
        paceProjection: 'SPEED_DUEL',
        earlySpeedHorses: [2, 3, 5],
        speedDuelLikely: true,
        loneSpeedException: false,
        beneficiaries: [{ programNumber: 7, advantage: 'Closer benefits from pace collapse' }],
      });

      const result = parsePaceScenarioResponse(promptOutput);

      expect(result.paceProjection).toBe('HOT');
      expect(result.speedDuelLikely).toBe(true);
      expect(result.loneSpeedException).toBe(false);
    });

    it('should parse MODERATE pace projection', () => {
      const promptOutput = JSON.stringify({
        paceProjection: 'MODERATE',
        earlySpeedHorses: [2],
        speedDuelLikely: false,
        loneSpeedException: false,
        beneficiaries: [],
      });

      const result = parsePaceScenarioResponse(promptOutput);

      expect(result.paceProjection).toBe('MODERATE');
    });

    it('should parse SLOW pace projection', () => {
      const promptOutput = JSON.stringify({
        paceProjection: 'SLOW',
        speedDuelLikely: false,
        loneSpeedException: false,
      });

      const result = parsePaceScenarioResponse(promptOutput);

      expect(result.paceProjection).toBe('SLOW');
    });
  });

  describe('parseVulnerableFavoriteResponse', () => {
    it('should parse nested favoriteAnalysis structure (actual prompt output)', () => {
      const promptOutput = JSON.stringify({
        favoriteAnalysis: {
          programNumber: 3,
          horseName: 'BODEGAS',
          isVulnerable: true,
          vulnerabilityFlags: ['TRIP DEPENDENCY', 'PACE UNFAVORABLE'],
          solidFoundation: ['Strong speed figures', 'Class edge'],
          overallAssessment: 'Vulnerable to pace pressure despite class edge',
        },
        confidence: 'HIGH',
        recommendedAction: 'FADE',
        beneficiaries: [2, 5, 7],
        reasoning: 'Multiple speed horses will push hot pace, benefiting closers',
      });

      const result = parseVulnerableFavoriteResponse(promptOutput);

      expect(result.isVulnerable).toBe(true);
      expect(result.confidence).toBe('HIGH');
      expect(result.reasons).toContain('TRIP DEPENDENCY');
      expect(result.reasons).toContain('PACE UNFAVORABLE');
    });

    it('should handle non-vulnerable favorite', () => {
      const promptOutput = JSON.stringify({
        favoriteAnalysis: {
          programNumber: 3,
          horseName: 'STRONG FAVORITE',
          isVulnerable: false,
          vulnerabilityFlags: [],
          solidFoundation: ['Best speed', 'Class drop', 'Hot trainer'],
          overallAssessment: 'Solid favorite with multiple edges',
        },
        confidence: 'HIGH',
        recommendedAction: 'RESPECT',
        reasoning: 'Too many positives to fade',
      });

      const result = parseVulnerableFavoriteResponse(promptOutput);

      expect(result.isVulnerable).toBe(false);
      expect(result.confidence).toBe('HIGH');
    });

    it('should fall back to reasoning if no vulnerabilityFlags', () => {
      const promptOutput = JSON.stringify({
        favoriteAnalysis: {
          isVulnerable: true,
        },
        confidence: 'MEDIUM',
        reasoning: 'This is the reasoning for vulnerability',
      });

      const result = parseVulnerableFavoriteResponse(promptOutput);

      expect(result.isVulnerable).toBe(true);
      // When no vulnerabilityFlags array, falls back to reasoning string
      expect(result.reasons).toContain('This is the reasoning for vulnerability');
    });

    it('should fall back to overallAssessment if no vulnerabilityFlags or reasoning', () => {
      const promptOutput = JSON.stringify({
        favoriteAnalysis: {
          isVulnerable: true,
          overallAssessment: 'Vulnerable assessment here',
        },
        confidence: 'MEDIUM',
      });

      const result = parseVulnerableFavoriteResponse(promptOutput);

      expect(result.isVulnerable).toBe(true);
      expect(result.reasons).toContain('Vulnerable assessment here');
    });
  });

  describe('parseFieldSpreadResponse', () => {
    it('should parse nested fieldAssessment structure (actual prompt output)', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'COMPETITIVE',
          topTierCount: 3,
          contenderCount: 5,
          isBettableRace: true,
          passReason: null,
        },
        horseClassifications: [
          {
            programNumber: 3,
            horseName: 'BODEGAS',
            classification: 'A',
            includeOnTickets: true,
            reason: 'Top choice',
          },
          {
            programNumber: 2,
            horseName: 'BANK ON BEBE',
            classification: 'A',
            includeOnTickets: true,
            reason: 'Close second',
          },
          {
            programNumber: 5,
            horseName: 'LADY DELILAH',
            classification: 'B',
            includeOnTickets: true,
            reason: 'Contender',
          },
        ],
        // No betStructure, so recommendedSpread is derived from fieldType
      });

      const result = parseFieldSpreadResponse(promptOutput);

      expect(result.fieldType).toBe('COMPETITIVE');
      expect(result.topTierCount).toBe(3);
      expect(result.recommendedSpread).toBe('MEDIUM'); // COMPETITIVE defaults to MEDIUM
      expect(result.horseClassifications).toHaveLength(3);
      expect(result.horseClassifications![0].classification).toBe('A');
    });

    it('should derive NARROW from betStructure with key approach', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'COMPETITIVE',
          topTierCount: 3,
        },
        betStructure: {
          recommendedApproach: 'Key #3 over others in exotics',
        },
      });

      const result = parseFieldSpreadResponse(promptOutput);

      // When betStructure mentions "key", it overrides field type default
      expect(result.recommendedSpread).toBe('NARROW');
    });

    it('should handle DOMINANT field type', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'DOMINANT',
          topTierCount: 1,
        },
      });

      const result = parseFieldSpreadResponse(promptOutput);

      expect(result.fieldType).toBe('DOMINANT');
      expect(result.recommendedSpread).toBe('NARROW');
    });

    it('should handle WIDE_OPEN field type', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'WIDE_OPEN',
          topTierCount: 6,
        },
      });

      const result = parseFieldSpreadResponse(promptOutput);

      expect(result.fieldType).toBe('WIDE_OPEN');
      expect(result.recommendedSpread).toBe('WIDE');
    });

    it('should handle SEPARATED field type', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'SEPARATED',
          topTierCount: 2,
        },
      });

      const result = parseFieldSpreadResponse(promptOutput);

      expect(result.fieldType).toBe('SEPARATED');
      expect(result.recommendedSpread).toBe('NARROW');
    });

    it('should derive recommendedSpread from betStructure', () => {
      const promptOutput = JSON.stringify({
        fieldAssessment: {
          fieldType: 'COMPETITIVE',
          topTierCount: 4,
        },
        betStructure: {
          recommendedApproach: 'Wide spread needed due to competitive field',
        },
      });

      const result = parseFieldSpreadResponse(promptOutput);

      expect(result.recommendedSpread).toBe('WIDE');
    });
  });
});
