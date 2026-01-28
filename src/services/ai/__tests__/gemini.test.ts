/**
 * Tests for Gemini AI Service
 */

import { describe, it, expect } from 'vitest';
import { parseGeminiResponse, BOT_MODEL_CONFIG, getModelForBot } from '../gemini';
import type { BotType } from '../gemini';
import { checkAIServiceStatus } from '../index';
import type { AIServiceError } from '../types';

// ============================================================================
// MOCK RESPONSE DATA
// ============================================================================

const validResponse = {
  raceNarrative: 'A competitive field with the favorite looking vulnerable to pace pressure.',
  confidence: 'MEDIUM',
  bettableRace: true,
  horseInsights: [
    {
      programNumber: 1,
      horseName: 'Fast Runner',
      projectedFinish: 1,
      valueLabel: 'BEST BET',
      oneLiner: 'Lone speed should wire this field with an easy lead.',
      keyStrength: 'Clear early speed advantage',
      keyWeakness: null,
      isContender: true,
      avoidFlag: false,
    },
    {
      programNumber: 2,
      horseName: 'Steady Eddie',
      projectedFinish: 2,
      valueLabel: 'FAIR PRICE',
      oneLiner: 'Consistent runner with closing kick if pace collapses.',
      keyStrength: 'Consistent form',
      keyWeakness: 'Needs pace help',
      isContender: true,
      avoidFlag: false,
    },
    {
      programNumber: 3,
      horseName: 'Longshot Larry',
      projectedFinish: 5,
      valueLabel: 'NO CHANCE',
      oneLiner: 'Outclassed at this level.',
      keyStrength: null,
      keyWeakness: 'Class question',
      isContender: false,
      avoidFlag: true,
    },
  ],
  topPick: 1,
  avoidList: [3],
  vulnerableFavorite: false,
  likelyUpset: false,
  chaoticRace: false,
};

// ============================================================================
// TESTS: parseGeminiResponse
// ============================================================================

describe('parseGeminiResponse', () => {
  describe('valid JSON parsing', () => {
    it('parses valid JSON response correctly', () => {
      const jsonText = JSON.stringify(validResponse);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.raceId).toBe('race-5');
      expect(result.raceNumber).toBe(5);
      expect(result.processingTimeMs).toBe(1500);
      expect(result.raceNarrative).toBe(validResponse.raceNarrative);
      expect(result.confidence).toBe('MEDIUM');
      expect(result.bettableRace).toBe(true);
      expect(result.horseInsights).toHaveLength(3);
      expect(result.topPick).toBe(1);
      expect(result.avoidList).toEqual([3]);
      expect(result.vulnerableFavorite).toBe(false);
      expect(result.likelyUpset).toBe(false);
      expect(result.chaoticRace).toBe(false);
    });

    it('includes timestamp in ISO format', () => {
      const jsonText = JSON.stringify(validResponse);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('correctly parses horse insights', () => {
      const jsonText = JSON.stringify(validResponse);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.horseInsights.length).toBeGreaterThan(0);
      const firstHorse = result.horseInsights[0]!;
      expect(firstHorse.programNumber).toBe(1);
      expect(firstHorse.horseName).toBe('Fast Runner');
      expect(firstHorse.projectedFinish).toBe(1);
      expect(firstHorse.valueLabel).toBe('BEST BET');
      expect(firstHorse.oneLiner).toContain('Lone speed');
      expect(firstHorse.keyStrength).toBe('Clear early speed advantage');
      expect(firstHorse.keyWeakness).toBeNull();
      expect(firstHorse.isContender).toBe(true);
      expect(firstHorse.avoidFlag).toBe(false);
    });
  });

  describe('markdown-wrapped JSON parsing', () => {
    it('handles ```json wrapper', () => {
      const wrappedJson = '```json\n' + JSON.stringify(validResponse) + '\n```';
      const result = parseGeminiResponse(wrappedJson, 5, 1500);

      expect(result.raceNarrative).toBe(validResponse.raceNarrative);
      expect(result.horseInsights).toHaveLength(3);
    });

    it('handles plain ``` wrapper', () => {
      const wrappedJson = '```\n' + JSON.stringify(validResponse) + '\n```';
      const result = parseGeminiResponse(wrappedJson, 5, 1500);

      expect(result.raceNarrative).toBe(validResponse.raceNarrative);
      expect(result.horseInsights).toHaveLength(3);
    });

    it('handles whitespace around JSON', () => {
      const wrappedJson = '  \n' + JSON.stringify(validResponse) + '\n  ';
      const result = parseGeminiResponse(wrappedJson, 5, 1500);

      expect(result.raceNarrative).toBe(validResponse.raceNarrative);
    });

    it('handles ```json with no newline', () => {
      const wrappedJson = '```json' + JSON.stringify(validResponse) + '```';
      const result = parseGeminiResponse(wrappedJson, 5, 1500);

      expect(result.raceNarrative).toBe(validResponse.raceNarrative);
    });
  });

  describe('error handling', () => {
    it('throws on invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parseGeminiResponse(invalidJson, 5, 1500)).toThrow();
    });

    it('throws error with PARSE_ERROR code on invalid JSON', () => {
      const invalidJson = '{ "broken": }';

      try {
        parseGeminiResponse(invalidJson, 5, 1500);
        expect.fail('Should have thrown');
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.code).toBe('PARSE_ERROR');
        expect(aiError.message).toContain('Failed to parse');
        expect(aiError.timestamp).toBeDefined();
      }
    });

    it('throws when horseInsights is missing', () => {
      const missingInsights = JSON.stringify({
        raceNarrative: 'Test',
        confidence: 'HIGH',
        bettableRace: true,
        // horseInsights missing
        topPick: 1,
        avoidList: [],
      });

      try {
        parseGeminiResponse(missingInsights, 5, 1500);
        expect.fail('Should have thrown');
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.code).toBe('PARSE_ERROR');
        expect(aiError.message).toContain('Missing horseInsights');
      }
    });

    it('throws when horseInsights is not an array', () => {
      const invalidInsights = JSON.stringify({
        raceNarrative: 'Test',
        confidence: 'HIGH',
        bettableRace: true,
        horseInsights: 'not an array',
        topPick: 1,
        avoidList: [],
      });

      try {
        parseGeminiResponse(invalidInsights, 5, 1500);
        expect.fail('Should have thrown');
      } catch (error) {
        const aiError = error as AIServiceError;
        expect(aiError.code).toBe('PARSE_ERROR');
        expect(aiError.message).toContain('Missing horseInsights');
      }
    });

    it('throws on completely empty response', () => {
      expect(() => parseGeminiResponse('', 5, 1500)).toThrow();
    });

    it('throws on null-like strings', () => {
      expect(() => parseGeminiResponse('null', 5, 1500)).toThrow();
    });
  });

  describe('default values', () => {
    it('uses default confidence when missing', () => {
      const responseWithoutConfidence = {
        ...validResponse,
        confidence: undefined,
      };
      const jsonText = JSON.stringify(responseWithoutConfidence);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.confidence).toBe('MEDIUM');
    });

    it('uses default bettableRace when missing', () => {
      const responseWithoutBettable = {
        ...validResponse,
        bettableRace: undefined,
      };
      const jsonText = JSON.stringify(responseWithoutBettable);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.bettableRace).toBe(true);
    });

    it('uses empty array for avoidList when missing', () => {
      const responseWithoutAvoid = {
        ...validResponse,
        avoidList: undefined,
      };
      const jsonText = JSON.stringify(responseWithoutAvoid);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.avoidList).toEqual([]);
    });

    it('uses null for topPick when missing', () => {
      const responseWithoutPick = {
        ...validResponse,
        topPick: undefined,
      };
      const jsonText = JSON.stringify(responseWithoutPick);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.topPick).toBeNull();
    });

    it('defaults flags to false when missing', () => {
      const responseWithoutFlags = {
        raceNarrative: 'Test',
        confidence: 'HIGH',
        bettableRace: true,
        horseInsights: validResponse.horseInsights,
        topPick: 1,
        avoidList: [],
        // vulnerableFavorite, likelyUpset, chaoticRace all missing
      };
      const jsonText = JSON.stringify(responseWithoutFlags);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.vulnerableFavorite).toBe(false);
      expect(result.likelyUpset).toBe(false);
      expect(result.chaoticRace).toBe(false);
    });

    it('uses empty string for raceNarrative when missing', () => {
      const responseWithoutNarrative = {
        ...validResponse,
        raceNarrative: undefined,
      };
      const jsonText = JSON.stringify(responseWithoutNarrative);
      const result = parseGeminiResponse(jsonText, 5, 1500);

      expect(result.raceNarrative).toBe('');
    });
  });
});

// ============================================================================
// TESTS: checkAIServiceStatus
// ============================================================================

describe('checkAIServiceStatus', () => {
  it('returns a valid status string', () => {
    const status = checkAIServiceStatus();

    expect(['ready', 'processing', 'offline', 'error']).toContain(status);
  });

  it('returns ready in browser-like environment (API errors caught at call time)', () => {
    // In browser-like test environment (jsdom), the function returns 'ready'
    // because API key checking happens when actual calls are made
    // This is by design - actual errors are caught when API calls fail
    const status = checkAIServiceStatus();

    // Browser environments assume ready, actual errors caught at call time
    expect(status).toBe('ready');
  });
});

// ============================================================================
// TESTS: Bot Model Configuration
// ============================================================================

describe('BOT_MODEL_CONFIG', () => {
  it('defines all four bot types', () => {
    expect(BOT_MODEL_CONFIG).toHaveProperty('TRIP_TROUBLE');
    expect(BOT_MODEL_CONFIG).toHaveProperty('PACE_SCENARIO');
    expect(BOT_MODEL_CONFIG).toHaveProperty('VULNERABLE_FAVORITE');
    expect(BOT_MODEL_CONFIG).toHaveProperty('FIELD_SPREAD');
  });

  it('assigns gemini-2.0-flash-lite to Trip Trouble', () => {
    expect(BOT_MODEL_CONFIG.TRIP_TROUBLE).toBe('gemini-2.0-flash-lite');
  });

  it('assigns gemini-2.5-flash-lite to Pace Scenario', () => {
    expect(BOT_MODEL_CONFIG.PACE_SCENARIO).toBe('gemini-2.5-flash-lite');
  });

  it('assigns gemini-2.5-flash-lite to Vulnerable Favorite', () => {
    expect(BOT_MODEL_CONFIG.VULNERABLE_FAVORITE).toBe('gemini-2.5-flash-lite');
  });

  it('assigns gemini-2.0-flash-lite to Field Spread', () => {
    expect(BOT_MODEL_CONFIG.FIELD_SPREAD).toBe('gemini-2.0-flash-lite');
  });
});

describe('getModelForBot', () => {
  it('returns correct model for TRIP_TROUBLE', () => {
    expect(getModelForBot('TRIP_TROUBLE')).toBe('gemini-2.0-flash-lite');
  });

  it('returns correct model for PACE_SCENARIO', () => {
    expect(getModelForBot('PACE_SCENARIO')).toBe('gemini-2.5-flash-lite');
  });

  it('returns correct model for VULNERABLE_FAVORITE', () => {
    expect(getModelForBot('VULNERABLE_FAVORITE')).toBe('gemini-2.5-flash-lite');
  });

  it('returns correct model for FIELD_SPREAD', () => {
    expect(getModelForBot('FIELD_SPREAD')).toBe('gemini-2.0-flash-lite');
  });

  it('returns model matching BOT_MODEL_CONFIG for each bot type', () => {
    const botTypes: BotType[] = [
      'TRIP_TROUBLE',
      'PACE_SCENARIO',
      'VULNERABLE_FAVORITE',
      'FIELD_SPREAD',
    ];

    botTypes.forEach((botType) => {
      expect(getModelForBot(botType)).toBe(BOT_MODEL_CONFIG[botType]);
    });
  });
});
