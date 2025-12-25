# Scoring Engine Diagnostic Report

## Executive Summary

This report documents a comprehensive audit of the scoring engine to identify why favorites consistently rank last despite having strong fundamentals. The analysis reveals **systematic issues with bonus category scoring** that disadvantage favorites and advantage longshots.

---

## PART 1: Category Weight Distribution

### Current Max Points Per Category

| Category                       | Max Points | Percentage | Industry Standard |
| ------------------------------ | ---------- | ---------- | ----------------- |
| **Core Categories (242 pts)**  |            |            |                   |
| Speed/Class                    | 80         | 26.3%      | 25-35% ✅         |
| Pace                           | 45         | 14.8%      | 10-15% ✅         |
| Form                           | 40         | 13.2%      | 20-25% ⚠️ UNDER   |
| Post Position                  | 30         | 9.9%       | 3-8% ⚠️ OVER      |
| Connections                    | 27         | 8.9%       | 5-10% ✅          |
| Equipment                      | 20         | 6.6%       | 2-5% ⚠️ OVER      |
| **Bonus Categories (59 pts)**  |            |            |                   |
| Distance/Surface               | 20         | 6.6%       | 3-8% ✅           |
| Trainer Patterns               | 15         | 4.9%       | 0-5% ✅           |
| Combo Patterns                 | 12         | 3.9%       | 0-5% ✅           |
| Track Specialist               | 6          | 2.0%       | 0-3% ✅           |
| Trainer Surface/Distance       | 6          | 2.0%       | 0-3% ✅           |
| **Subtle Adjustments (3 pts)** |            |            |                   |
| Weight Change                  | 1          | 0.3%       | N/A               |
| Age Factor                     | ±1         | 0.3%       | N/A               |
| Sire's Sire                    | ±1         | 0.3%       | N/A               |
| **TOTAL BASE SCORE**           | **304**    | **100%**   |                   |

### Key Weight Observations

1. **Form is underweighted** (13.2% vs industry 20-25%)
   - Recent win should have more impact
   - Current weighted averaging dilutes recent wins

2. **Post Position is overweighted** (9.9% vs industry 3-8%)
   - Should be situational, not this significant

3. **Equipment is overweighted** (6.6% vs industry 2-5%)
   - Speculative factor given too much weight

4. **Bonus categories total 59 pts (19.4%)**
   - These are situational bonuses, not core handicapping factors
   - They favor horses with specific triggers, not necessarily the best horses

---

## PART 2: Systematic Issues Identified

### ISSUE 1: Bonus Categories Favor Situational Triggers Over Quality

The 59 bonus points (19% of total score) are only awarded for specific conditions:

| Category          | Points | Requirement                       | Problem                         |
| ----------------- | ------ | --------------------------------- | ------------------------------- |
| Distance/Surface  | 0-20   | Proven turf/wet/distance record   | First-timers get 0, not neutral |
| Trainer Patterns  | 0-15   | 5+ starts in pattern              | New trainers get 0              |
| Combo Patterns    | 0-12   | Class drop + equipment change     | Favors longshots                |
| Track Specialist  | 0-6    | 4+ starts at track, 30%+ win rate | Shippers get 0                  |
| Trainer Surf/Dist | 0-6    | Trainer pattern data              | New trainers get 0              |

**A favorite missing all bonuses could be 59 points behind a longshot who triggers all of them.**

### ISSUE 2: Missing Data Treated as Penalty, Not Neutral

```
Example: First-time turf horse
- Has 0 turf starts
- Gets 0 points for turf affinity (max 8 pts)
- Horse with 5 turf starts and 30% win rate gets 8 pts
- 8-point GAP for being "unproven"
```

This is not neutral scoring - it's a hidden penalty.

### ISSUE 3: Combo Patterns Systematically Favor Longshots

The combo pattern system awards points for:

- Class drop + first-time Lasix (4 pts)
- Class drop + first-time blinkers (4 pts)
- Class drop + jockey upgrade (4 pts)
- Class drop + second off layoff (4 pts)

**Favorites typically:**

- Race at their appropriate level (no class drop)
- Have stable equipment (no first-time changes)
- Already have top jockey (no upgrade)

**Longshots typically:**

- Drop in class for a win attempt
- Add equipment changes
- Get jockey upgrades

**Result:** Longshots can gain 12+ pts from combos that favorites can't access.

### ISSUE 4: Connections Scoring Punishes New-to-Meet Connections

```typescript
// connections.ts:511-524
if (trainerMeetStarts < 3) {
  trainerScore = 7; // Neutral score (7/16 = 44%)
} else if (trainerMeetWinPercent >= 20) {
  trainerScore = 16; // Max score
}
```

**Impact:**

- Elite shippers with top trainers get 7 pts (neutral)
- Local trainers with 20%+ win rate get 16 pts
- 9-point gap for being "new to meet"

This penalizes quality trainers who are simply new to the meet.

### ISSUE 5: Form Scoring May Under-Weight Recent Wins

Form uses a weighted average:

- Last race: 50%
- 2nd back: 30%
- 3rd back: 20%

A horse that won last race but had poor earlier races:

- Won last (20 pts × 0.5 = 10)
- 10th 2nd back (4 pts × 0.3 = 1.2)
- 10th 3rd back (4 pts × 0.2 = 0.8)
- Total: 12 pts out of 20 max = 60%

**A horse that won its last race should score closer to max on recent form.**

---

## PART 3: Case Study Analysis

### Why a 1-1 Favorite Might Rank 6th/6

Consider a typical 1-1 favorite:

- **Racing at appropriate level** → No class drop combo (0/12 combo pts)
- **Stable equipment** → No first-time equipment (0 additional combo pts)
- **Shipping to new track** → No track specialist (0/6 pts)
- **First time on turf** → No turf affinity (0/8 pts)
- **New trainer at meet** → Neutral connections (7/16 trainer pts)
- **First-time at distance** → No distance affinity (0/6 pts)

**Potential missing points: 42+ pts**

Meanwhile, a 15-1 longshot:

- **Dropping in class** → Combo patterns triggered (+8 pts)
- **Adding equipment** → Combo patterns triggered (+4 pts)
- **Local trainer** → Max trainer score (+16 pts vs +7)
- **Proven at track** → Track specialist (+6 pts)
- **Proven at distance** → Distance affinity (+6 pts)

**Potential bonus points: 30+ pts advantage**

---

## PART 4: Weight Rebalancing Recommendations

### High Priority (Should Implement)

1. **Increase Form Weight to 50 pts** (16.4%)
   - Recent winner should be more impactful
   - Reduce weighted averaging impact or increase win-last-out bonus

2. **Make Distance/Surface/Track Specialist "Neutral" for Missing Data**
   - 0 starts should = neutral score (50% of max), not 0 pts
   - Only penalize horses with POOR records (e.g., 0/10 wins)

3. **Reduce Combo Pattern Impact**
   - Max 8 pts instead of 12 pts
   - Or make them informational only (not affect rank)

### Medium Priority (Consider)

4. **Reduce Post Position to 20 pts** (6.6%)
   - More in line with industry standards
   - Track bias should be the main factor, not default weight

5. **Reduce Equipment to 12 pts** (4%)
   - Equipment changes are speculative
   - Should be fine-tuning, not significant factor

6. **Improve Connections Scoring for Shippers**
   - Use overall trainer/jockey stats, not just meet stats
   - Elite trainer should score high even if new to meet

### Low Priority (Informational)

7. **Make Trainer Patterns informational only**
   - Display but don't affect ranking
   - They're interesting but not predictive enough to weight heavily

---

## PART 5: Diagnostic Tools Created

### New File: `src/lib/scoring/diagnostics.ts`

Provides the following diagnostic functions:

```typescript
// Diagnose a single horse's scoring
function diagnoseHorseScoring(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackCondition?: TrackCondition,
  fieldSize?: number
): HorseDiagnostic;

// Diagnose entire field
function diagnoseField(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  trackCondition?: TrackCondition
): FieldDiagnostic;

// Get weight distribution analysis
function analyzeWeightDistribution(): WeightDistributionAnalysis[];

// Get formatted table for console
function getWeightDistributionTable(): string;

// Get summary of identified issues
function getSummaryIssues(): string[];
```

### Output Format

```typescript
interface HorseDiagnostic {
  horseName: string;
  programNumber: number;
  morningLineOdds: string;
  marketImpliedWinProb: number; // From odds
  modelImpliedWinProb: number; // From score
  disagreementLevel: 'low' | 'medium' | 'high' | 'extreme';
  baseScore: number;
  totalScore: number;
  categoryScores: Record<string, CategoryScoreAnalysis>;
  weakestCategories: string[]; // <50% of max
  strongestCategories: string[]; // >75% of max
  potentialIssues: string[];
  favoriteFlags: string[]; // Why favorite might rank low
}
```

---

## PART 6: Test Cases Added

### File: `src/__tests__/lib/scoring/diagnostics.test.ts`

29 test cases covering:

1. **Market probability calculations**
   - 1-1 odds → 50% probability
   - 5-1 odds → 16.7% probability

2. **Category scoring analysis**
   - Weak categories (<50%) identified
   - Strong categories (>75%) identified
   - Percentage calculations correct

3. **Favorite-specific diagnostics**
   - Flags for low connections
   - Flags for missing bonus categories
   - Recent winner form score validation

4. **Weight distribution analysis**
   - All categories analyzed
   - Misaligned weights flagged
   - Recommendations provided

5. **Field diagnostics**
   - All horses diagnosed
   - Systematic issues identified
   - Summary statistics correct

6. **Validation test cases**
   - "1-1 favorite that won last race should score in top 2"
   - "Horse with best speed figure should score high on Speed/Class"
   - "Horse with 0 track record should not be penalized (neutral)"

---

## Root Cause Hypothesis

**Favorites rank low because:**

1. **Bonus categories (19% of score) are designed for situational triggers that longshots are more likely to have**
   - Class droppers get combo points
   - Equipment changers get combo points
   - Local trainers/jockeys get higher connection scores

2. **Missing data is treated as a penalty rather than neutral**
   - First-time on surface = 0 pts
   - First-time at track = 0 pts
   - New trainer at meet = reduced score

3. **Core predictive factors (speed, form) are slightly underweighted**
   - A horse with the best speed figure and recent win should dominate
   - But 59 bonus points can overcome a 40-point speed/form advantage

**The scoring system rewards "changes" and "proven at this specific condition" over raw ability.**

---

## Files Created/Modified

### Created:

- `src/lib/scoring/diagnostics.ts` - Diagnostic tools module
- `src/__tests__/lib/scoring/diagnostics.test.ts` - Test cases
- `src/docs/SCORING_DIAGNOSTIC_REPORT.md` - This report

### Not Modified:

- No scoring logic was changed (diagnostic only)
- No UI was modified

---

## Next Steps

After review, consider implementing the following in priority order:

1. **Quick Win:** Make missing distance/surface/track data = neutral (50% of max) instead of 0
2. **Form Fix:** Increase form weight or add "won last out" bonus
3. **Combo Reduction:** Reduce combo pattern max from 12 to 8, or make informational
4. **Connection Improvement:** Use overall trainer stats for shippers, not just meet stats

All changes should be tested with actual race data to validate improvement before deployment.
