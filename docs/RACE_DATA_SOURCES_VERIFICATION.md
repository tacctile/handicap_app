# Race Data Sources Verification Report

**Date:** February 2026
**Branch:** claude/verify-race-data-sources-h1XPL
**Status:** ✅ ALL VERIFIED

---

## Purpose

Verify that all data displayed in the race analysis UI is sourced from algorithm calculations, not hardcoded or stale.

---

## Race View Data Sources

| UI Element | Value Shown | Source Function | File:Line | Dynamic? |
|------------|-------------|-----------------|-----------|----------|
| BETTABLE indicator | "BETTABLE" / "CAUTION" / "PASS" | `getVerdictLabel()` from `determineRaceVerdict()` | `RaceVerdictHeader.tsx:48-56` / `useValueDetection.ts:277-336` | Yes |
| High Confidence | "High Confidence" / "Moderate" / "Low" | `getConfidenceLabel()` from `determinePlayConfidence()` | `RaceVerdictHeader.tsx:62-73` / `useValueDetection.ts:259-272` | Yes |
| Top Pick Selection | Horse name + program# | `analyzeRaceValue()` → `primaryValuePlay` | `useValueDetection.ts:537-539, 589` | Yes |
| Fair Odds | e.g., "4-1" | `calculateFairOdds()` = `100 / modelWinProb - 1` | `RaceVerdictHeader.tsx:97-101` | Yes |
| Edge Percentage | e.g., "+87%" | `calculateValueEdge()` = `(modelProb - impliedProb) / impliedProb * 100` | `useValueDetection.ts:176-179` | Yes |
| Bet Type Recommendation | "WIN" / "PLACE" / "SHOW" | `determineBetType()` based on rank, edge, top3Prob, odds | `useValueDetection.ts:217-250` | Yes |
| Projected Finish (#1-#6) | Rank based on baseScore | `calculateRaceScores()` → sorting by baseScore → rank assignment | `scoring/index.ts:1431-1458` | Yes |
| Value Labels | "BEST BET", "STRONG PICK", etc. | `getValueTag()` from 15-tag matrix | `valueTagMatrix.ts:202-225` | Yes |

---

## Analyze Race Flow

- **Primary Component:** `RaceVerdictHeader` (`src/components/RaceVerdictHeader.tsx`)
- **Data Hook:** `useValueDetection` → `analyzeRaceValue()` (`src/hooks/useValueDetection.ts:416-597`)
- **Scoring Component:** `Dashboard.tsx` uses `calculateRaceScores()` in `useMemo` (lines 400-422)

### Recalculation Dependencies

```typescript
// Dashboard.tsx:413-422
[
  parsedData,
  selectedRaceIndex,
  raceState.updatedOdds,        // Odds changes
  raceState.scratchedHorses,    // Scratch changes
  raceState.trackCondition,     // Track condition changes
  raceState.getOdds,
  raceState.isScratched,
  raceState.reactivityVersion,  // Guarantees recalculation
]
```

---

## Horse Detail Flow

- **Component:** `HorseDetailModal` (`src/components/HorseDetailModal.tsx`)
- **Score Breakdown Shown:** Yes - all categories from `score.breakdown`

### Categories Displayed (from `SCORE_LIMITS` in `scoring/index.ts:238-259`)

| Category | Max Points |
|----------|------------|
| Speed & Class | 140 |
| Form | 50 |
| Pace | 45 |
| Connections | 24 |
| Distance/Surface | 20 |
| Post Position | 12 |
| Track Specialist | 10 |
| Combo Patterns | 10 |
| Equipment | 8 |
| Trainer Patterns | 8 |

---

## Hardcoded Data Check

| Check | Result |
|-------|--------|
| Hardcoded horse names in components | 0 found |
| Hardcoded odds values | 0 found |
| Hardcoded "BEST BET" labels | 0 found |
| Value labels dynamically assigned | ✅ Confirmed |

**Status:** CLEAN

---

## Recalculation Trigger Verification

| Trigger | ALGORITHM_REFERENCE.md | Implementation | File:Line |
|---------|------------------------|----------------|-----------|
| Track Condition Change | Line 689 | ✅ `triggerRecalculation(undefined, 'score')` | `useRaceState.ts:219-227` |
| Horse Scratched | Line 690 | ✅ `triggerRecalculation(new Set([horseIndex]), 'score')` | `useRaceState.ts:230-249` |
| Horse Unscratched | Line 691 | ✅ `triggerRecalculation(new Set([horseIndex]), 'score')` | `useRaceState.ts:252-268` |
| Odds Updated | Line 692 | ✅ `triggerRecalculation(new Set([horseIndex]), 'odds')` | `useRaceState.ts:271-286` |
| Odds Reset | Line 693 | ✅ `triggerRecalculation(new Set([horseIndex]), 'odds')` | `useRaceState.ts:289-299` |
| Debounce Delay | 300ms (Line 699) | ✅ 300ms | `useRaceState.ts:157` |
| History Max Length | 50 (Line 700) | ✅ 50 | `useRaceState.ts:140` |

---

## Value Tag Matrix System

Location: `src/lib/value/valueTagMatrix.ts`

### Rank Tiers (lines 135-139)

| Tier | Rank Range |
|------|------------|
| TOP | #1-2 |
| MID | #3-5 (or 50% of field) |
| BOTTOM | #6+ |

### Edge Buckets (lines 144-150)

| Bucket | Edge Range |
|--------|------------|
| STRONG_OVERLAY | ≥ +50% |
| MILD_OVERLAY | +15% to +50% |
| FAIR | -15% to +15% |
| MILD_UNDERLAY | -40% to -15% |
| STRONG_UNDERLAY | < -40% |

### 15-Tag Matrix (lines 44-126)

Labels are dynamically assigned based on:
```typescript
getValueTag(baseScoreRank, fieldSize, edgePercent)
```

Example mappings:
- TOP + STRONG_OVERLAY → "BEST BET" / "PRIME VALUE"
- TOP + MILD_OVERLAY → "STRONG PICK" / "SOLID EDGE"
- MID + MILD_UNDERLAY → "RISKY" / "UNDERLAID"
- BOTTOM + STRONG_UNDERLAY → "NO CHANCE" / "DEAD MONEY"

---

## Summary

| Item | Status |
|------|--------|
| All race view data from algorithm | ✅ |
| All horse detail data from algorithm | ✅ |
| Recalculation working | ✅ |
| No hardcoded values | ✅ |
| Documentation matches implementation | ✅ |

---

## Issues Found

**None**

All data displayed in the race analysis UI is dynamically sourced from algorithm calculations. No hardcoded horse names, odds values, or labels were found in display components.
