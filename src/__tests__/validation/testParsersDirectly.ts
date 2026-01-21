#!/usr/bin/env npx tsx
/**
 * Direct Parser Test
 *
 * Tests the parsers directly with mock API responses to bypass network issues.
 * This helps identify if the parsing logic is the problem.
 *
 * Usage:
 *   npx tsx src/__tests__/validation/testParsersDirectly.ts
 */

import {
  parseTripTroubleResponse,
  parsePaceScenarioResponse,
  parseVulnerableFavoriteResponse,
  parseFieldSpreadResponse,
} from '../../services/ai/gemini';

console.log('\n' + '═'.repeat(70));
console.log('              DIRECT PARSER TEST');
console.log('═'.repeat(70));

// ============================================================================
// MOCK RESPONSES - These simulate what Gemini might return
// ============================================================================

// Test case 1: Clean JSON response (what we expect)
const cleanJsonResponses = {
  tripTrouble: `{
    "horsesWithTripTrouble": [
      {
        "programNumber": 3,
        "horseName": "Test Horse",
        "issue": "Blocked in last 2 races",
        "maskedAbility": true
      }
    ]
  }`,
  paceScenario: `{
    "paceProjection": "HOT",
    "speedDuelLikely": true,
    "loneSpeedException": false,
    "earlySpeedHorses": [1, 5, 7],
    "closersToWatch": [3, 8]
  }`,
  vulnerableFavorite: `{
    "isVulnerable": true,
    "confidence": "HIGH",
    "reasons": ["Poor recent form", "Bad post position"]
  }`,
  fieldSpread: `{
    "fieldType": "COMPETITIVE",
    "topTierCount": 4,
    "horseClassifications": [
      {"programNumber": 1, "classification": "A", "keyCandidate": true, "spreadOnly": false},
      {"programNumber": 2, "classification": "B", "keyCandidate": false, "spreadOnly": false}
    ]
  }`,
};

// Test case 2: JSON wrapped in markdown code blocks (common Gemini behavior)
const markdownWrappedResponses = {
  tripTrouble: '```json\n' + cleanJsonResponses.tripTrouble + '\n```',
  paceScenario: '```json\n' + cleanJsonResponses.paceScenario + '\n```',
  vulnerableFavorite: '```json\n' + cleanJsonResponses.vulnerableFavorite + '\n```',
  fieldSpread: '```json\n' + cleanJsonResponses.fieldSpread + '\n```',
};

// Test case 3: JSON with explanation text before/after (another common Gemini pattern)
const textWrappedResponses = {
  tripTrouble:
    'Based on my analysis of the race, here is the trip trouble assessment:\n\n' +
    cleanJsonResponses.tripTrouble +
    '\n\nLet me know if you need any clarification.',
  paceScenario:
    "I've analyzed the pace scenario for this race:\n\n" +
    cleanJsonResponses.paceScenario +
    '\n\nThis suggests closers may have an advantage.',
  vulnerableFavorite:
    "Looking at the favorite's profile:\n\n" +
    cleanJsonResponses.vulnerableFavorite +
    '\n\nI would recommend fading this horse.',
  fieldSpread:
    'Here is the field spread analysis:\n\n' +
    cleanJsonResponses.fieldSpread +
    '\n\nThe field appears fairly competitive.',
};

// Test case 4: Different field names (possible variation)
const alternateFieldNames = {
  tripTrouble: `{
    "horses_with_trip_trouble": [
      {
        "program_number": 3,
        "horse_name": "Test Horse",
        "issue": "Blocked in last 2 races",
        "masked_ability": true
      }
    ]
  }`,
  paceScenario: `{
    "pace_projection": "HOT",
    "speed_duel_likely": true,
    "lone_speed_exception": false,
    "early_speed_horses": [1, 5, 7],
    "closers_to_watch": [3, 8]
  }`,
  vulnerableFavorite: `{
    "is_vulnerable": true,
    "confidence": "HIGH",
    "reasons": ["Poor recent form", "Bad post position"]
  }`,
  fieldSpread: `{
    "field_type": "COMPETITIVE",
    "top_tier_count": 4,
    "horse_classifications": [
      {"program_number": 1, "classification": "A", "key_candidate": true, "spread_only": false}
    ]
  }`,
};

// Test case 5: Empty/minimal responses
const minimalResponses = {
  tripTrouble: `{"horsesWithTripTrouble": []}`,
  paceScenario: `{"paceProjection": "MODERATE", "speedDuelLikely": false, "loneSpeedException": false}`,
  vulnerableFavorite: `{"isVulnerable": false, "confidence": "LOW", "reasons": []}`,
  fieldSpread: `{"fieldType": "MIXED", "topTierCount": 3}`,
};

// ============================================================================
// TEST FUNCTION
// ============================================================================

function testParser(
  parserName: string,
  parser: (text: string) => unknown,
  testCases: { name: string; input: string }[]
): void {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Testing ${parserName} parser`);
  console.log('─'.repeat(70));

  for (const testCase of testCases) {
    console.log(`\n  Test: ${testCase.name}`);
    console.log(`  Input preview: ${testCase.input.substring(0, 100).replace(/\n/g, '\\n')}...`);

    try {
      const result = parser(testCase.input);
      console.log(`  ✓ SUCCESS`);
      console.log(`  Result: ${JSON.stringify(result, null, 2).substring(0, 300)}...`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ FAILED`);
      console.log(`  Error: ${errorMsg}`);
    }
  }
}

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('\nTesting all parsers with various response formats...\n');

// Test Trip Trouble Parser
testParser('TripTrouble', parseTripTroubleResponse, [
  { name: 'Clean JSON', input: cleanJsonResponses.tripTrouble },
  { name: 'Markdown wrapped', input: markdownWrappedResponses.tripTrouble },
  { name: 'Text wrapped', input: textWrappedResponses.tripTrouble },
  { name: 'Snake_case fields', input: alternateFieldNames.tripTrouble },
  { name: 'Minimal response', input: minimalResponses.tripTrouble },
]);

// Test Pace Scenario Parser
testParser('PaceScenario', parsePaceScenarioResponse, [
  { name: 'Clean JSON', input: cleanJsonResponses.paceScenario },
  { name: 'Markdown wrapped', input: markdownWrappedResponses.paceScenario },
  { name: 'Text wrapped', input: textWrappedResponses.paceScenario },
  { name: 'Snake_case fields', input: alternateFieldNames.paceScenario },
  { name: 'Minimal response', input: minimalResponses.paceScenario },
]);

// Test Vulnerable Favorite Parser
testParser('VulnerableFavorite', parseVulnerableFavoriteResponse, [
  { name: 'Clean JSON', input: cleanJsonResponses.vulnerableFavorite },
  { name: 'Markdown wrapped', input: markdownWrappedResponses.vulnerableFavorite },
  { name: 'Text wrapped', input: textWrappedResponses.vulnerableFavorite },
  { name: 'Snake_case fields', input: alternateFieldNames.vulnerableFavorite },
  { name: 'Minimal response', input: minimalResponses.vulnerableFavorite },
]);

// Test Field Spread Parser
testParser('FieldSpread', parseFieldSpreadResponse, [
  { name: 'Clean JSON', input: cleanJsonResponses.fieldSpread },
  { name: 'Markdown wrapped', input: markdownWrappedResponses.fieldSpread },
  { name: 'Text wrapped', input: textWrappedResponses.fieldSpread },
  { name: 'Snake_case fields', input: alternateFieldNames.fieldSpread },
  { name: 'Minimal response', input: minimalResponses.fieldSpread },
]);

console.log('\n' + '═'.repeat(70));
console.log('              TEST COMPLETE');
console.log('═'.repeat(70));
