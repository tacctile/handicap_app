# Disagreement Analysis Report

## STATUS: BLOCKED - Results File Not Found

**Date Generated:** 2026-01-17
**Branch:** claude/analyze-disagreement-losses-NzXJ8

---

## Executive Summary

The detailed disagreement analysis could not be completed because the validation results file (`src/data/ai_comparison_results.json`) does not exist. This file is generated when `aiVsAlgorithm.test.ts` runs but has not been persisted.

**Task Context:** From a 111-race validation test, there were reportedly 8 disagreement losses (4 AI wrong, 4 algorithm wrong). This report documents:
1. Why the analysis is blocked
2. What data IS currently captured by the test
3. What data is NOT captured (critical gaps)
4. Recommendations for enhanced logging

---

## Part 1: Validation Test Data Status

### Expected Results File
```
src/data/ai_comparison_results.json
```

**Status:** NOT FOUND

### Available Data Files
The following results files exist but contain only raw race outcomes (not AI/algorithm comparison data):

| File | Track | Status |
|------|-------|--------|
| AQU1228_results.txt | Aqueduct | Raw results only |
| DED1230_results.txt | Delta Downs | Raw results only |
| FGX1228_results.txt | Fair Grounds | Raw results only |
| GPX1224_results.txt | Gulfstream Park | Raw results only |
| GPX1227_results.txt | Gulfstream Park | Raw results only |
| PEN0821_results.txt | Penn National | Raw results only |
| PEN1219_results.txt | Penn National | Raw results only |
| PRX1229_results.txt | Parx Racing | Raw results only |
| PRX1230_results.txt | Parx Racing | Raw results only |
| SAX1228_results.txt | Santa Anita | Raw results only |
| SAX1229_results.txt | Santa Anita | Raw results only |
| TUP1230_results.txt | Turf Paradise | Raw results only |

### Required Action
Run the AI validation test to generate results:
```bash
npm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts
```

**Note:** Requires `VITE_GEMINI_API_KEY` environment variable to be set.

---

## Part 2: Data Currently Captured by Test

When the validation test runs, it captures the following in `RaceComparison` objects:

### Race Identification
- `trackCode` - Track abbreviation (e.g., "SAR", "GP")
- `raceNumber` - Race number (1-12 typically)

### Actual Results
- `actualWinner` - Post position of winner
- `actualExacta` - Post positions of 1st and 2nd
- `actualTrifecta` - Post positions of 1st, 2nd, and 3rd

### Algorithm Predictions
- `algorithmPick` - Post position of algorithm's top pick
- `algorithmTop3` - Array of top 3 post positions
- `algorithmCorrect` - Boolean: did algorithm pick the winner?
- `algorithmInTop3` - Boolean: was winner in algorithm's top 3?
- `algorithmExactaHit` - Boolean: exact 1-2 match
- `algorithmTrifectaHit` - Boolean: exact 1-2-3 match

### AI Predictions
- `aiPick` - Post position of AI's top pick (or null if AI failed)
- `aiTop3` - Array of AI's top 3 post positions
- `aiCorrect` - Boolean: did AI pick the winner?
- `aiInTop3` - Boolean: was winner in AI's top 3?
- `aiExactaHit` - Boolean: exact 1-2 match
- `aiTrifectaHit` - Boolean: exact 1-2-3 match

### Comparison Flags
- `agreedOnWinner` - Boolean: AI and algorithm had same top pick
- `aiDisagreedAndWon` - Boolean: AI differed from algorithm AND AI was right
- `aiDisagreedAndLost` - Boolean: AI differed from algorithm AND algorithm was right

### AI Metadata
- `aiProcessingMs` - How long AI took
- `aiConfidence` - AI's confidence level (HIGH/MEDIUM/LOW)
- `aiFlaggedVulnerableFavorite` - Boolean
- `aiFlaggedLikelyUpset` - Boolean

### Exotic Bet Results
- `algorithmExotics` - Detailed exotic bet hit tracking
- `aiExotics` - Detailed exotic bet hit tracking

---

## Part 3: Critical Data Gaps

The following data is **NOT CAPTURED** but would be essential for disagreement analysis:

### Gap 1: Horse Names (CRITICAL)
**Current:** Only post positions are stored
**Needed:** Horse names for human-readable analysis
**Impact:** Cannot identify specific horses without manual lookup

### Gap 2: Algorithm Scores and Tiers (CRITICAL)
**Current:** Only `algorithmPick` (post position)
**Needed:**
- Full score breakdown for algorithm's top pick
- Tier classification (1/2/3)
- Confidence level
- Score margin between 1st and 2nd

**Impact:** Cannot analyze WHY algorithm favored a horse

### Gap 3: AI Reasoning/Narrative (CRITICAL)
**Current:** Not captured
**Needed:**
- `raceNarrative` - AI's overall race assessment
- Individual `oneLiner` insights for each horse
- `keyStrength` and `keyWeakness` for top picks

**Impact:** Cannot understand WHY AI overrode algorithm

### Gap 4: Multi-Bot Analysis Details (HIGH)
**Current:** Only final `aiPick` is stored
**Needed:**
- TripTrouble bot output (which horses had masked ability)
- PaceScenario bot output (pace projection, lone speed exceptions)
- VulnerableFavorite bot output (reasons for vulnerability)
- FieldSpread bot output (field type, contender count)

**Impact:** Cannot trace AI decision back to specific bot signals

### Gap 5: Race Conditions (MEDIUM)
**Current:** Not captured
**Needed:**
- Surface (dirt/turf)
- Distance (sprint/route)
- Field size
- Race class

**Impact:** Cannot analyze patterns by race type

### Gap 6: Odds Data (MEDIUM)
**Current:** Not captured
**Needed:**
- Morning line odds for top picks
- Whether AI/algorithm picks were overlays

**Impact:** Cannot assess value angle of picks

### Gap 7: Winner's Algorithm Score (HIGH)
**Current:** Not captured
**Needed:**
- What score did the actual winner have?
- What rank did algorithm give the winner?

**Impact:** Cannot determine if losses were "bad beats" (winner had low score) vs "misranks" (winner had high score but ranked lower)

---

## Part 4: Placeholder Analysis Structure

Once results are available, the analysis should follow this format:

### AI DISAGREED AND LOST (Expected: 4 races)

For each race where AI overrode algorithm and lost:

```
### Race X: [Track] R[Number] - [Date]
- Algorithm pick: [Horse Name] (Score: X, Tier: X, Confidence: X)
- AI pick: [Horse Name] (Score: X, Tier: X)
- AI reasoning: [raceNarrative or "NOT CAPTURED"]
- Multi-bot signals: [tripTrouble: X, pace: X, vulnerable: X, spread: X]
- Actual winner: [Horse Name] (Algorithm Score: X, Algorithm Rank: X)
- Analysis: [Pattern identification]
```

### ALGORITHM DISAGREED AND LOST (Expected: 4 races)

For each race where algorithm's pick lost but AI's pick won:

```
### Race X: [Track] R[Number] - [Date]
- Algorithm pick: [Horse Name] (Score: X, Tier: X, Confidence: X)
- AI pick: [Horse Name] (Score: X, Tier: X)
- AI reasoning: [raceNarrative]
- What AI saw: [tripTrouble/pace/vulnerable signals]
- Actual winner: AI's pick won
- Analysis: [What algorithm missed]
```

---

## Part 5: Recommended Logging Enhancements

### Priority 1: Enhance RaceComparison Interface

Add to `aiVsAlgorithm.test.ts`:

```typescript
interface EnhancedRaceComparison extends RaceComparison {
  // Horse identification
  algorithmPickName: string;
  aiPickName: string;
  winnerName: string;

  // Algorithm details
  algorithmTopPickScore: number;
  algorithmTopPickTier: number;
  algorithmTopPickConfidence: string;
  algorithmScoreMargin: number; // gap between 1st and 2nd
  winnerAlgorithmScore: number;
  winnerAlgorithmRank: number;

  // AI reasoning
  aiRaceNarrative: string;
  aiTopPickOneLiner: string;
  aiTopPickKeyStrength: string | null;
  aiTopPickKeyWeakness: string | null;

  // Multi-bot signals
  tripTroubleSignal: boolean;
  tripTroubleHorse: number | null;
  paceProjection: string | null;
  loneSpeedException: boolean;
  vulnerableFavoriteSignal: boolean;
  vulnerableFavoriteReasons: string[];
  fieldType: string | null;

  // Race conditions
  surface: string;
  distance: number;
  fieldSize: number;
  raceClass: string;

  // Odds
  algorithmPickOdds: string;
  aiPickOdds: string;
  winnerOdds: string;
}
```

### Priority 2: Capture Multi-Bot Raw Results

Store the `MultiBotRawResults` object for each race:

```typescript
interface RaceProcessingResult {
  // ... existing fields ...
  multiBotRaw: MultiBotRawResults | null;
}
```

### Priority 3: Log Disagreement Details Separately

Create a separate `disagreements.json` file capturing only disagreement races with full detail:

```typescript
interface DisagreementRecord {
  race: EnhancedRaceComparison;
  multiBotDetails: MultiBotRawResults;
  aiAnalysis: AIRaceAnalysis;
  algorithmScores: ScoredHorse[];
}
```

---

## Part 6: Next Steps

1. **Immediate:** Run the validation test to generate `ai_comparison_results.json`
   ```bash
   npm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts
   ```

2. **After Results Available:** Re-run this analysis task to extract the 8 disagreement races

3. **Enhancement:** Implement Priority 1-3 logging changes before next validation run

4. **Long-term:** Set up GitHub Actions to persist results as artifacts (already configured in `.github/workflows/ai-validation.yml`)

---

## Appendix: Test Architecture Summary

The validation test uses a multi-bot AI architecture with 4 specialized bots:

| Bot | Purpose | Override Trigger |
|-----|---------|------------------|
| TripTrouble | Identifies horses with masked ability | +1 or +2 rank boost if HIGH/MEDIUM confidence |
| PaceScenario | Analyzes pace dynamics | +1 boost for lone speed or closer advantage |
| VulnerableFavorite | Evaluates if favorite is beatable | -1 rank drop for favorite if HIGH confidence |
| FieldSpread | Assesses competitive separation | Influences contender count (capped at 4) |

The combiner applies conservative adjustments (max ±2 positions) and only overrides algorithm when specific bot criteria are met.

---

**Report Generated By:** Claude Code
**Task Branch:** claude/analyze-disagreement-losses-NzXJ8
