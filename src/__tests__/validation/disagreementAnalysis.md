# Disagreement Analysis Report

## STATUS: ENHANCED LOGGING IMPLEMENTED

**Date Updated:** 2026-01-17
**Branch:** claude/analyze-disagreement-losses-NzXJ8

---

## Implementation Summary

Enhanced validation test logging has been implemented to capture detailed disagreement data for pattern analysis.

### Files Created

| File | Purpose |
|------|---------|
| `src/__tests__/validation/types.ts` | TypeScript interfaces for detailed race results |
| `src/__tests__/validation/analyzeResults.ts` | Standalone analysis script |
| `src/__tests__/validation/results/` | Output directory for results |

### Files Modified

| File | Changes |
|------|---------|
| `src/__tests__/validation/aiVsAlgorithm.test.ts` | Enhanced to capture detailed data |

---

## New Data Captured

### DetailedRaceResult Interface

Each race now captures:

#### Race Identification
- `trackCode` - Track abbreviation
- `trackName` - Full track name
- `raceNumber` - Race number
- `date` - Race date
- `surface` - dirt/turf
- `distance` - Distance string
- `distanceFurlongs` - Numeric furlongs
- `fieldSize` - Number of horses
- `raceClass` - Race type

#### Algorithm Pick Details
```typescript
algorithmPick: {
  postPosition: number;
  horseName: string;
  score: number;
  tier: 1 | 2 | 3 | 0;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  topCategories: string[];  // Top 3 scoring categories
  scoreMargin: number;      // Gap to 2nd place
}
```

#### AI Pick Details
```typescript
aiPick: {
  postPosition: number | null;
  horseName: string | null;
  algorithmScore: number | null;  // What algorithm gave this horse
  algorithmRank: number | null;
  tier: 1 | 2 | 3 | 0;
  reasoning: string;              // AI's narrative explanation
  overrideType: 'CONFIRM' | 'OVERRIDE' | 'PASS';
  topPickOneLiner: string | null;
  keyStrength: string | null;
  keyWeakness: string | null;
}
```

#### Actual Result
```typescript
winner: {
  postPosition: number;
  horseName: string;
  algorithmScore: number;
  algorithmRank: number;
  algorithmTier: 1 | 2 | 3 | 0;
  odds: string;
  wasAlgorithmPick: boolean;
  wasAiPick: boolean;
}
```

#### Bot Signals
```typescript
botSignals: {
  tripTrouble: string | null;
  tripTroubleHorses: Array<{ post, name, issue }>;
  paceProjection: 'HOT' | 'MODERATE' | 'SLOW' | null;
  loneSpeedException: boolean;
  speedDuelLikely: boolean;
  vulnerableFavorite: boolean;
  vulnerableFavoriteReasons: string[];
  fieldType: 'TIGHT' | 'SEPARATED' | 'MIXED' | null;
  topTierCount: number | null;
}
```

---

## Output Files

### Primary Results File
```
src/__tests__/validation/results/ai_comparison_results.json
```

Contains:
- `generatedAt` - Timestamp
- `version` - "2.0.0"
- `summary` - Aggregate statistics
- `detailedResults` - Array of DetailedRaceResult
- `disagreements` - Pre-filtered disagreement races

### Legacy Results File (backwards compatibility)
```
src/data/ai_comparison_results.json
```

---

## Analysis Tools

### Standalone Analyzer

Run the analyzer to output disagreement patterns:

```bash
# Full analysis with pattern groupings
npx ts-node src/__tests__/validation/analyzeResults.ts

# JSON output for programmatic use
npx ts-node src/__tests__/validation/analyzeResults.ts --json

# Only disagreement details (skip groupings)
npx ts-node src/__tests__/validation/analyzeResults.ts --disagreements-only
```

### Analysis Output Includes

1. **Pattern Groupings**
   - By track
   - By surface (dirt/turf)
   - By distance (sprint/route)
   - By AI confidence level
   - By score differential (tight/moderate/dominant)
   - By field size (small/medium/large)
   - By override type (CONFIRM/OVERRIDE/PASS)

2. **Detailed Disagreement Races**
   - Full race context
   - Algorithm pick with score breakdown
   - AI pick with reasoning
   - Actual winner with algorithm ranking
   - Bot signals present

3. **Pattern Analysis**
   - Score differential patterns in AI losses
   - Tier analysis
   - Confidence analysis
   - Bot signal correlation

4. **Recommendations**
   - Based on identified patterns
   - Actionable prompt adjustments

---

## API: getDisagreements Function

```typescript
import { getDisagreements } from './types';

const disagreements = getDisagreements(detailedResults);
// Returns:
// {
//   aiDisagreedAndWon: DetailedRaceResult[];    // AI was right
//   aiDisagreedAndLost: DetailedRaceResult[];   // Algorithm was right
//   algorithmWonDisagreement: DetailedRaceResult[]; // Same as above
// }
```

---

## Running the Validation Test

```bash
# Run the full validation test
npm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts

# Then analyze results
npx ts-node src/__tests__/validation/analyzeResults.ts
```

**Note:** Requires `VITE_GEMINI_API_KEY` environment variable.

---

## Sample DetailedRaceResult

```json
{
  "trackCode": "SAX",
  "trackName": "Santa Anita",
  "raceNumber": 5,
  "date": "2024-12-28",
  "surface": "dirt",
  "distance": "6f",
  "distanceFurlongs": 6,
  "fieldSize": 8,
  "raceClass": "CLM",

  "algorithmPick": {
    "postPosition": 3,
    "horseName": "Fast Runner",
    "score": 185,
    "tier": 1,
    "confidence": "HIGH",
    "topCategories": ["Speed: 45", "Form: 38", "Pace: 32"],
    "scoreMargin": 12
  },

  "aiPick": {
    "postPosition": 7,
    "horseName": "Dark Horse",
    "algorithmScore": 168,
    "algorithmRank": 3,
    "tier": 2,
    "reasoning": "OVERRIDE: #7 Dark Horse has masked ability from trip trouble - promoted to top pick",
    "overrideType": "OVERRIDE",
    "topPickOneLiner": "Trip trouble masked true ability in last start",
    "keyStrength": "Strong closing speed hidden by traffic trouble",
    "keyWeakness": null
  },

  "winner": {
    "postPosition": 3,
    "horseName": "Fast Runner",
    "algorithmScore": 185,
    "algorithmRank": 1,
    "algorithmTier": 1,
    "odds": "5-2",
    "wasAlgorithmPick": true,
    "wasAiPick": false
  },

  "agreement": false,
  "outcome": "ALGO_CORRECT",

  "botSignals": {
    "tripTrouble": "detected",
    "tripTroubleHorses": [],
    "paceProjection": null,
    "loneSpeedException": false,
    "speedDuelLikely": false,
    "vulnerableFavorite": false,
    "vulnerableFavoriteReasons": [],
    "fieldType": null,
    "topTierCount": null
  },

  "aiProcessingMs": 2450,
  "aiConfidence": "MEDIUM",
  "aiFlaggedVulnerableFavorite": false,
  "aiFlaggedLikelyUpset": false
}
```

---

## Remaining Data Gaps

The following data is not yet captured (would require multi-bot raw results):

| Gap | Status | Impact |
|-----|--------|--------|
| Individual bot raw outputs | Not captured | Would allow tracing decisions to specific bot |
| Trip trouble horse list | Empty array | Extracted from narrative only |
| Top tier count from field spread | Null | Not exposed from combiner |

These could be addressed in a future enhancement by exposing `MultiBotRawResults` from the AI service.

---

**Report Updated By:** Claude Code
**Task Branch:** claude/analyze-disagreement-losses-NzXJ8
