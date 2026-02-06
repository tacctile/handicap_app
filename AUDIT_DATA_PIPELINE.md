# Data Pipeline Audit: Scoring Algorithm → UI Display

> **Audit Date:** February 2026
> **Scope:** Full trace from scoring engine output through betting pipeline to UI rendering
> **Status:** READ-ONLY audit — no files modified

---

## DATA FLOW INTEGRITY

### Scoring Engine Output Fields (src/lib/scoring/index.ts)

The `HorseScore` interface outputs:
- `total` — Final score (base + overlay), 0-376
- `baseScore` — Base score before overlay, 0-336
- `overlayScore` — Overlay adjustment, ±40
- `breakdown` — Full `ScoreBreakdown` with 14+ category sub-scores
- `isScratched` — Scratch status
- `confidenceLevel` — 'high' | 'medium' | 'low'
- `dataQuality` — 0-100 percentage
- `breedingScore` — Detailed breeding (lightly raced horses)
- `classScore` — Enhanced class analysis
- `overlayResult` — Full overlay sections (A-G)
- `oddsResult` — Odds analysis (informational, not in base score)
- `dataCompleteness` — Field completeness grades
- `lowConfidencePenaltyApplied` / `lowConfidencePenaltyAmount`
- `paperTigerPenaltyApplied` / `paperTigerPenaltyAmount`
- `keyRaceIndexBonus` / `keyRaceIndexResult`
- `fieldSpreadAdjustment` / `fieldSpreadResult`

### ScoreBreakdown Categories (14 primary + 6 optional):

| Category | Max Pts | In ScoreBreakdown |
|----------|---------|-------------------|
| Speed & Class | 140 | `speedClass.total` (speedScore + classScore) |
| Form | 50 | `form.total` |
| Pace | 45 | `pace.total` |
| Connections | 24 | `connections.total` (trainer + jockey + partnership) |
| Post Position | 12 | `postPosition.total` |
| Equipment | 8 | `equipment.total` |
| Distance/Surface | 20 | `distanceSurface.total` |
| Track Specialist | 10 | `trackSpecialist.total` |
| Combo Patterns | 10 | `comboPatterns.total` |
| Trainer Patterns | 8 | `trainerPatterns.total` |
| Trainer Surf/Dist | 6 | `trainerSurfaceDistance.total` |
| Weight | 1 | `weightAnalysis.total` |
| Age Factor | ±1 | `ageAnalysis.adjustment` |
| Sire's Sire | ±1 | `siresSireAnalysis.adjustment` |
| Sex Analysis | -1 to 0 | `sexAnalysis.total` |
| **Optional:** | | |
| Overlay (±40) | ±40 | `overlay.cappedScore` (7 sections) |
| Breeding | varies | `breeding.contribution` |
| Class Analysis | varies | `classAnalysis.total` |
| Paper Tiger | varies | `paperTiger.penaltyAmount` |
| Key Race Index | 0-6 | `keyRaceIndex.total` |
| Trip Trouble | 0-4 | `tripTrouble.adjustment` |
| Field Spread | info | `fieldSpread.fieldType` |
| Pace Scenario | info | `paceScenario.scenario` |

### Fields Consumed by Top Bets Generator (topBetsGenerator.ts)

The generator consumes from `ScoredHorse`:
- `score.baseScore` — Used for probability calculation via score-proportional model
- `horse.programNumber` — Horse identification
- `horse.horseName` — Display name
- `horse.morningLineOdds` — Odds baseline
- `score.isScratched` — Filtering

**Fields NOT consumed by Top Bets Generator:**
- All breakdown sub-categories (speedClass, form, pace, etc.)
- `overlayResult` sections
- `confidenceLevel`
- `dataQuality`
- `dataCompleteness`
- `breedingScore`
- `classScore`
- `keyRaceIndexResult`
- `fieldSpreadResult`

### Fields Consumed by Bet Recommendations (betRecommendations.ts)

Consumes from `ClassifiedHorse` (produced by tierClassification.ts):
- `horse.programNumber`, `horse.horseName`
- `score.total`, `score.isScratched`
- `tier` — Tier classification
- `confidence` — Calculated confidence
- `odds` — Parsed decimal odds
- `oddsDisplay` — Display string
- `valueScore` — Value metric
- `horseIndex` — Array index

### Fields Consumed by UI Components

**TopBetsView.tsx** renders: rank, riskTier (filtering only), horses, cost, whatToSay, whyThisBet (tooltip), probability, internalType
**TopBetCard.tsx** renders: rank, riskTier, betType, horses, cost, estimatedPayout, probability, expectedValue, whatToSay, whatThisBetIs, whyThisBet, combinationsInvolved
**TopBetsPanel.tsx** renders: raceContext, totalCombinationsAnalyzed, summary stats, filter counts

### Fields Calculated But Never Displayed

1. **Overlay Breakdown Sections** — 7 overlay sections (paceAndBias, formCycle, tripAnalysis, classMovement, connectionEdges, distanceSurface, headToHead) stored in `breakdown.overlay` but never rendered in any UI component
2. **8 Scoring Sub-Categories** — Distance/Surface, Track Specialist, Combo Patterns, Trainer Patterns, Trainer Surface/Distance, Weight, Age, Sire's Sire are calculated but not shown in HorseDetailModal breakdown
3. **Data Completeness Details** — `missingCritical`, `missingHigh` arrays calculated but not surfaced
4. **Key Race Index Matches** — Individual match details calculated but not displayed
5. **Field Spread Details** — Tier assignments, box size recommendations, sit-out conditions calculated but not shown
6. **Paper Tiger Reasoning** — Full reasoning string exists but not displayed
7. **Pace Scenario Details** — Scenario type, running style, confidence exist but informational only

---

## DISPLAY ACCURACY

### Tier Thresholds: MATCH (Betting Tiers) / MATCH (Display Tiers)

**Betting Tier Classification** (tierClassification.ts):
| Tier | Min Score | Max Score | Min Confidence | Status |
|------|-----------|-----------|----------------|--------|
| Tier 1 | 181 | 251 | 70% | ✅ MATCH |
| Tier 2 | 161 | 180 | 60% | ✅ MATCH |
| Tier 3 | 131 | 160 | 40% | ✅ MATCH |

**Score Display Thresholds** (index.ts SCORE_THRESHOLDS):
| Tier | Min Score | % of Base | Status |
|------|-----------|-----------|--------|
| Elite | 269+ | 80%+ | ✅ MATCH |
| Strong | 218-268 | 65-79% | ✅ MATCH |
| Contender | 168-217 | 50-64% | ✅ MATCH |
| Fair | 118-167 | 35-49% | ✅ MATCH |
| Weak | <118 | <35% | ✅ MATCH |

### Score Category Breakdown: MISMATCH (Critical)

**HorseDetailModal.tsx displays WRONG max values for ScoreProgress bars:**

| Category | Displayed Max | Correct Max | File:Line |
|----------|---------------|-------------|-----------|
| Trainer Score | /35 | /10 | HorseDetailModal.tsx:949 |
| Jockey Score | /15 | /12 | HorseDetailModal.tsx:975 |
| Speed Score | /30 | /105 | HorseDetailModal.tsx:1120 |
| Class Score | /20 | /35 | HorseDetailModal.tsx:1126 |

**Impact:** Progress bars show incorrect fill percentages. A trainer score of 8/10 (80%) displays as 8/35 (23%).

**Only 6 of 14+ categories shown in breakdown:**
1. Connections (24 max)
2. Post Position / Bias (12 max)
3. Speed Figures / Class (140 max)
4. Form / Conditioning (50 max)
5. Equipment / Medication (8 max)
6. Pace / Tactical (45 max)

**Missing from breakdown display:**
- Distance/Surface (20 max)
- Track Specialist (10 max)
- Combo Patterns (10 max)
- Trainer Patterns (8 max)
- Trainer Surface/Distance (6 max)
- Weight (1 max)
- Age Factor (±1)
- Sire's Sire (±1)

### Overlay Display: MISMATCH (Two Systems)

**Two separate overlay systems exist with no integration:**

| System | File | Purpose | Displayed? |
|--------|------|---------|------------|
| Scoring Overlay (±40 pts) | overlayScoring.ts | 7-section adjustment to base score | ❌ Never shown |
| Betting Overlay (%) | overlayAnalysis.ts | Market value / overlay percentage | ✅ Shown in modal |

The scoring overlay (±40) is correctly enforced with hard caps (overlayScoring.ts:1240-1301) but its 7-section breakdown is never rendered in any UI component. Instead, users see the betting overlay percentage from overlayAnalysis.ts.

---

## BLIND SPOTS FOUND

### CRITICAL (Score Display Errors)

**1. Wrong max values in HorseDetailModal ScoreProgress bars**
- Files: `src/components/HorseDetailModal.tsx:949, 975, 1120, 1126`
- Trainer shows /35 (should be /10), Jockey shows /15 (should be /12)
- Speed shows /30 (should be /105), Class shows /20 (should be /35)
- These cause progress bars to display dramatically incorrect fill levels

**2. getScoreColor() called with score.total instead of score.baseScore**
- File: `src/components/HorseDetailModal.tsx:481`
- Code: `const scoreColor = getScoreColor(score.total, score.isScratched);`
- The function is documented to accept baseScore (0-336), but receives total (0-376)
- Impact: Horses with high overlay adjustments may show wrong tier colors

**3. Confidence formula uses hardcoded 319 instead of 336 (MAX_BASE_SCORE)**
- File: `src/components/BettingRecommendations.tsx:871, 927`
- File: `src/components/ExoticBuilderModal.tsx:141`
- Code: `confidence: Math.min(100, 40 + (h.score.total / 319) * 60)`
- ALGORITHM_REFERENCE.md specifies: `confidence = 40 + (baseScore / 336) * 60`
- Impact: Confidence is inflated by ~5% for all horses in these components
- Also uses `score.total` instead of `baseScore`

### HIGH (Data Pipeline Gaps)

**4. Scoring overlay (±40) breakdown never displayed**
- File: `src/lib/scoring/index.ts:462-476` (calculated)
- 7 overlay sections (pace, form, trip, class, connections, distance, head-to-head) are computed
- Stored in `breakdown.overlay` but no UI component renders them
- Users cannot see what's boosting or penalizing a horse's overlay adjustment

**5. Two parallel value detection systems with different probability models**
- `src/hooks/useValueDetection.ts` — Linear probability: `baseScore / totalFieldScore`
- `src/lib/scoring/overlayAnalysis.ts` — Softmax probability with temperature
- Edge thresholds: 50% min (useValueDetection) vs 20% moderate (overlayAnalysis)
- No integration between the two systems
- May produce contradictory value assessments for the same horse

**6. 8 scoring categories calculated but invisible to users**
- Distance/Surface, Track Specialist, Combo Patterns, Trainer Patterns, Trainer Surf/Dist, Weight, Age, Sire's Sire
- These contribute up to 57 points (17% of max base score) with no UI visibility
- Users cannot understand why a horse scored higher/lower in these areas

### MEDIUM (Hardcoded Values / Duplication)

**7. Tier score thresholds duplicated in 3+ files**
- `src/lib/betting/tierClassification.ts` — TIER_CONFIG with 181/161/131
- `src/components/BettingRecommendations.tsx:856-857` — Hardcoded `180/160`
- `src/components/BettingRecommendations.tsx:919-920` — Duplicated again
- `src/lib/betting/betRecommender.ts:131-133` — `180/160/140`
- `src/lib/exotics/exoticCalculator.ts:95,98` — `180/140`
- Values diverge slightly (181 vs 180 for tier 1)

**8. Two separate Kelly criterion implementations**
- `src/lib/betting/kellyCriterion.ts` — Full-featured legacy implementation
- `src/lib/betting/kellyCalculator.ts` — Newer Quarter-Kelly focused
- Both implement correct formula but create maintenance burden
- `confidenceToWinProbability()` in kellyCriterion.ts is dead code (never called)

**9. recalculate.ts uses hardcoded 319 for quality bonus**
- File: `src/lib/calculations/recalculate.ts:94, 97`
- Uses `319` instead of `MAX_BASE_SCORE` (336) for quality and confidence calculations

### LOW (Display Gaps)

**10. TopBetsView drops several TopBet fields**
- `rank` — Not shown in compact view
- `riskTier` — Not shown (used only for filtering)
- `whatThisBetIs` — Not shown
- `estimatedPayout` — Not used
- `combinationsInvolved` — Not used
- These are shown in TopBetCard but not in the main TopBetsView

**11. No ±40 overlay range indicator in UI**
- The overlay scoring system caps at ±40 (enforced in overlayScoring.ts)
- No UI element shows this range or indicates where a horse falls within it
- Only the betting overlay percentage is displayed

**12. Hardcoded slider limits in BettingRecommendations.tsx**
- Exotic budget: min=5, max=100, step=5, default=20 (line 1290)
- Dutch stake: min=10, max=200, step=10, default=50 (line 1483)
- Budget warning at 20% threshold (line 615)
- Should be configurable constants

---

## RECOMMENDATIONS

### Priority 1 — Fix Incorrect Display Values
1. **Fix ScoreProgress max values** in HorseDetailModal.tsx — Trainer to /10, Jockey to /12, Speed to /105, Class to /35
2. **Fix getScoreColor() call** to pass `score.baseScore` instead of `score.total`
3. **Fix confidence formula** in BettingRecommendations.tsx and ExoticBuilderModal.tsx — replace hardcoded `319` with imported `MAX_BASE_SCORE` (336) and use `baseScore` not `total`

### Priority 2 — Surface Hidden Data
4. **Add missing scoring categories** to HorseDetailModal breakdown — at minimum Distance/Surface, Track Specialist, Combo Patterns, and Trainer Patterns (these are 48 pts / 14.3% of max)
5. **Display overlay breakdown** — Show the 7-section overlay analysis that's already calculated but never rendered

### Priority 3 — Consolidate Inconsistencies
6. **Centralize tier thresholds** — Create a single source of truth for tier score thresholds (181/161/131) and import everywhere instead of hardcoding 180/160/140
7. **Consolidate Kelly implementations** — Choose one Kelly module and deprecate the other
8. **Reconcile value detection systems** — Either integrate useValueDetection.ts with overlayAnalysis.ts or document why both exist with different probability models
9. **Replace all hardcoded 319** references with `MAX_BASE_SCORE` (336) across the codebase

### Priority 4 — Reduce Maintenance Burden
10. **Extract UI betting constants** — Move slider configs, preset thresholds, and budget warning percentages to a constants file
11. **Remove dead code** — `confidenceToWinProbability()` in kellyCriterion.ts is never called
12. **Document dual overlay systems** — If both scoring overlay (±40 pts) and betting overlay (%) are intentional, document the relationship

---

_End of Data Pipeline Audit_
