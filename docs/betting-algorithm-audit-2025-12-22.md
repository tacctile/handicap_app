# Furlong Betting Algorithm Audit Report
Generated: 2025-12-22

## Executive Summary

This comprehensive audit examines the Furlong betting algorithm from DRF data ingestion through bet recommendations. The scoring algorithm is sophisticated and mathematically sound, producing scores on a 0-240 point scale across multiple handicapping factors. However, the translation from quality scores to optimal bet suggestions has several disconnect points that reduce bet suggestion quality relative to score quality.

**Key Finding**: The primary issue is not in the scoring algorithm itself, but in **how scores are translated into bet decisions**. The score-to-probability calibration uses fixed tiers (e.g., 200+ pts = 75% win probability) that may not accurately reflect real-world outcomes. Additionally, the bet generation logic prioritizes tiers over adjusted scores in certain paths, potentially missing value opportunities.

**Critical Disconnect Identified**: Horses are sorted by `adjustedScore` (score + overlay bonus) for exotic bet selection, which correctly combines win probability with value. However, tier thresholds (180+, 160-179, 140-159) are static and don't account for field-relative performance or field quality. A 180-point horse in a weak field may be more bettable than a 180-point horse in a stacked field.

---

## Critical Issues (Must Fix)

### 1. Score-to-Probability Calibration is Uncalibrated Against Real Results
**Location**: `src/lib/value/confidenceCalibration.ts:117-125`

**Problem**: The default score-to-probability mapping uses arbitrary tiers:
```typescript
const DEFAULT_TIERS: ScoreTier[] = [
  { minScore: 200, maxScore: 241, winProbability: 75, label: 'Elite (200+)' },
  { minScore: 180, maxScore: 200, winProbability: 65, label: 'Strong (180-199)' },
  { minScore: 160, maxScore: 180, winProbability: 55, label: 'Good (160-179)' },
  // ...
];
```

These probabilities (75%, 65%, 55%, etc.) are theoretical and not validated against actual race outcomes. If actual win rates differ significantly, all EV calculations, value classifications, and betting decisions are compromised.

**Impact**: HIGH - All value calculations depend on accurate probability estimates. If a 200-point score actually wins 50% of the time instead of 75%, bets classified as "strong value" may actually be negative EV.

**Proposed Fix**:
1. Implement Phase 4 calibration tracking (already scaffolded in `confidenceCalibration.ts`)
2. Track actual outcomes against predicted probabilities
3. Use Brier Score to measure prediction quality
4. Adjust tier probabilities based on historical data
5. Consider field-relative scoring (score relative to field average)

**Implementation Complexity**: Medium

---

### 2. Fixed Tier Thresholds Ignore Field Context
**Location**: `src/lib/betting/tierClassification.ts`

**Problem**: Tier classification uses fixed score thresholds:
- Tier 1: 180+ points
- Tier 2: 160-179 points
- Tier 3: 140-159 points

This doesn't account for:
- Field quality (all horses scoring low vs. one standout)
- Race type differences (maiden races vs. G1 stakes)
- Relative separation between scores

A horse scoring 175 in a field where the next-best is 140 is a much stronger play than 175 in a field where three others score 170+.

**Impact**: HIGH - Bet recommendations may miss strong plays in weak fields while recommending marginal plays in competitive fields.

**Proposed Fix**:
1. Implement field-relative scoring: `relativeScore = (horseScore - fieldAverage) / fieldStdDev`
2. Adjust tier thresholds based on score distribution within the race
3. Flag "standout" scenarios where top horse is 20+ points above field

**Implementation Complexity**: Medium

---

### 3. Overlay Percentage Calculation Relies on Morning Line
**Location**: `src/lib/value/valueDetector.ts:524`

**Problem**: Value calculations use `horse.morningLineOdds`:
```typescript
const oddsDisplay = horse.morningLineOdds || '5-1';
```

Morning line odds are set by the track handicapper and often don't reflect actual betting patterns. A horse may be 5-1 morning line but 3-1 at post time, dramatically changing the value proposition.

**Impact**: CRITICAL - All overlay and EV calculations may be significantly off if morning line diverges from actual odds. Default fallback to '5-1' for missing data compounds this.

**Proposed Fix**:
1. Display clear warning when using morning line vs. live odds
2. If live odds integration is possible, use those
3. Implement sensitivity analysis showing EV at different odds levels
4. Never default to '5-1' - flag as "odds unavailable" and adjust confidence

**Implementation Complexity**: Low (warning) / High (live odds integration)

---

## High Priority Issues

### 4. Exotic Bet Horse Selection Uses Top 4 Regardless of Separation
**Location**: `src/lib/recommendations/betGenerator.ts:192-208`

**Problem**: Exacta and trifecta box bets automatically include top 4 horses by adjusted score:
```typescript
const exactaBoxHorses = allClassifiedHorses.slice(0, Math.min(4, allClassifiedHorses.length));
```

This doesn't check:
- Score separation between horses (is #4 competitive with #1?)
- Whether #3 and #4 are really contenders or just tier fillers
- Cost-to-probability ratio for 4-horse box vs. 3-horse

**Impact**: Medium-High - May be wasting combination cost on horses with low hit probability.

**Proposed Fix**:
1. Check score separation: only include horse if within 15-20 points of top score
2. Require minimum confidence threshold (e.g., 50%+) for inclusion
3. Calculate expected hit rate and cost-effectiveness before committing to 4-horse boxes

**Implementation Complexity**: Low

---

### 5. Kelly Criterion Only Available in Advanced Mode
**Location**: `src/lib/recommendations/betSizing.ts:337-339`

**Problem**: Kelly-based bet sizing is gated behind Advanced mode:
```typescript
if (!kellySettings?.enabled || config.mode !== 'advanced') {
  return { ... activeMethod: 'tier', ... };
}
```

Users in Simple or Moderate mode get tier-based flat sizing, which doesn't optimize for edge size.

**Impact**: Medium - Users may over-bet marginal edges and under-bet strong edges.

**Proposed Fix**:
1. Provide "light Kelly" option in Moderate mode
2. Apply fractional Kelly (quarter or half) to all bets as a multiplier
3. Show Kelly-suggested amount as reference even if not using it

**Implementation Complexity**: Low

---

### 6. Longshot Upset Probability Formula May Be Too Conservative
**Location**: `src/lib/longshots/longshotTypes.ts:381-387`

**Problem**: Upset probability calculation:
```typescript
export function calculateUpsetProbability(anglePoints: number): number {
  const baseProbability = (anglePoints / 100) * 0.15;
  return Math.min(0.25, baseProbability); // Capped at 25%
}
```

100 angle points = 15% upset probability. This seems low for a "nuclear" longshot with multiple strong angles. The 25% cap may be too restrictive.

**Impact**: Medium - May undervalue legitimate upset candidates, leading to underbet situations.

**Proposed Fix**:
1. Review actual upset rates for horses meeting nuclear criteria
2. Consider logarithmic scaling rather than linear
3. Adjust cap based on number of angles (4+ angles could exceed 25%)

**Implementation Complexity**: Low

---

### 7. Missing Correlation Between Exotic Legs
**Location**: `src/lib/recommendations/betGenerator.ts:819-874`

**Problem**: Potential return calculations for exotics use simple odds multiplication without accounting for:
- Correlation between finishers (same running style = lower joint probability)
- Field size impact on exacta/trifecta payouts
- Chalk-bomb differential (favorite over longshot vs. longshot over favorite)

**Impact**: Medium - Potential return estimates may be inaccurate, affecting bet selection decisions.

**Proposed Fix**:
1. Implement correlation adjustment for horses with same pace profile
2. Use historical payout data by field size to estimate returns
3. Differentiate expected payouts based on horse combinations

**Implementation Complexity**: Medium

---

## Medium Priority Issues

### 8. Form Trend Weight Distribution May Be Suboptimal
**Location**: `src/lib/scoring/form.ts:127-138`

**Problem**: Form weighting uses 50/30/20 for last 3 races:
```typescript
const weights = [0.5, 0.3, 0.2];
```

This heavily weights the most recent race, which may not account for:
- Bounce patterns (horse regresses after peak effort)
- Valid excuses that improve next-out expectation
- Training patterns between races

**Impact**: Low-Medium - May miss horses primed to improve or overweight horses due to regress.

**Proposed Fix**:
1. Implement bounce detection (career-best effort last out → expect regression)
2. Add valid excuse detection to modify weights
3. Consider 40/35/25 weighting for more balanced view

**Implementation Complexity**: Low

---

### 9. Pace Score Doesn't Account for Position Relative to Pace Shape
**Location**: `src/lib/scoring/pace.ts:242-345`

**Problem**: Pace scoring calculates tactical advantage based on style vs. scenario (e.g., closer in speed duel = good). However, it doesn't fully account for:
- Exactly how far back a closer typically sits (2 lengths vs. 10 lengths)
- Whether pace will genuinely collapse or just be "fast"
- Gate speed and ability to position

**Impact**: Low-Medium - May overvalue closers in contested pace when they can't make up ground.

**Proposed Fix**:
1. Weight tactical advantage by average lengths behind at first call
2. Add "closing ability" modifier based on gains from first call to finish
3. Consider gate speed for early positioning

**Implementation Complexity**: Medium

---

### 10. Class Drop Detection Misses Track-Tier Context
**Location**: `src/lib/scoring/speedClass.ts:206-229`

**Problem**: Class movement analysis compares race classifications but doesn't fully account for:
- Track tier (G1 at Churchill vs. G1 at Finger Lakes)
- Regional differences in class levels
- Purse value changes

**Impact**: Low-Medium - May undervalue significant drops that don't show in classification.

**Proposed Fix**:
1. Add purse-based class comparison
2. Implement track-tier adjustment (AAA vs. AA tracks)
3. Compare speed figure pars across tracks

**Implementation Complexity**: Medium

---

### 11. Diamond Detection Score Range Is Narrow
**Location**: `src/lib/diamonds/diamondTypes.ts:21-22`

**Problem**: Diamond detection only considers horses with scores 120-139:
```typescript
export const DIAMOND_SCORE_MIN = 120;
export const DIAMOND_SCORE_MAX = 139;
```

A horse scoring 145 with 300% overlay is excluded from diamond detection. The arbitrary cutoff may miss value.

**Impact**: Low-Medium - Potentially missing value plays just above the score threshold.

**Proposed Fix**:
1. Expand range to 120-155 for diamond consideration
2. Use sliding scale: higher score + overlay = still qualifies
3. Consider separate "value play" category for 140-159 range

**Implementation Complexity**: Low

---

### 12. Equipment Change Points May Be Miscalibrated
**Location**: `src/lib/scoring/equipment.ts:8-16`

**Problem**: Equipment change point values (12-20 for first-time Lasix, 10-16 for blinkers) are trainer-dependent but the base values aren't validated against outcome data.

**Impact**: Low - May over/underweight equipment changes relative to their actual impact.

**Proposed Fix**:
1. Track equipment change outcomes over time
2. Adjust base point values based on actual improvement rates
3. Consider surface-specific equipment impacts

**Implementation Complexity**: Medium

---

## Low Priority Issues

### 13. Post Position Scoring Uses Generic Defaults When No Track Data
**Location**: `src/lib/scoring/postPosition.ts:56-70`

**Problem**: Generic post position preferences are hardcoded for when track-specific data is unavailable. These may not reflect actual patterns at tracks without data.

**Impact**: Low - Affects accuracy but neutral bias (not systematically wrong direction).

**Proposed Fix**:
1. Display confidence indicator when using generic data
2. Reduce score weight when no track-specific bias available
3. Build track-specific data over time

**Implementation Complexity**: Low

---

### 14. Connections Scoring Builds DB From Single Race's PPs
**Location**: `src/lib/scoring/connections.ts:89-187`

**Problem**: The connections database is built from past performances of horses in the current race only. This provides limited sample sizes for trainer/jockey statistics.

**Impact**: Low - May have insufficient data for accurate trainer patterns. Code handles this with neutral scores.

**Proposed Fix**:
1. Consider persistent trainer/jockey database across sessions
2. Use DRF-provided trainer stats when available
3. Increase minimum sample size before applying patterns

**Implementation Complexity**: Medium

---

### 15. Bet Generator Creates Duplicate Logic Paths
**Location**: `src/lib/recommendations/betGenerator.ts:574-670`

**Problem**: Special category bet generation (nuclear longshots, diamonds, value bombs) duplicates some logic from tier-based generation, leading to potential duplicate bets that must be deduplicated.

**Impact**: Low - Deduplication handles this, but code complexity is increased.

**Proposed Fix**:
1. Refactor to single pass that tags bets with multiple categories
2. Unify special category detection with tier classification
3. Reduce code duplication

**Implementation Complexity**: Low

---

## What's Working Well

### ✅ Multi-Factor Scoring Architecture
The scoring system appropriately breaks down into distinct factors (speed/class, pace, connections, form, equipment, post position) with clear point allocations. The modular design allows for factor-specific tuning.

### ✅ Adjusted Score for Exotic Selection
Using `adjustedScore = baseScore + overlayBonus` for exotic bet horse selection correctly combines win probability assessment with value identification. This is a sound approach.

### ✅ Pace Analysis Sophistication
The Pace Pressure Index (PPI) calculation and tactical advantage scoring are well-designed. The running style classification (E/P/C/S) and scenario detection (soft/moderate/contested/speed_duel) provide nuanced analysis.

### ✅ Value Detector EV Calculations
The mathematical foundation for EV calculations is correct:
```typescript
EV = (WinProb × (DecimalOdds - 1)) - (LossProb × 1)
```
This properly calculates expected value per dollar wagered.

### ✅ Kelly Criterion Implementation
The Kelly formula implementation is correct with appropriate safety measures (fractional Kelly, max bet caps, minimum edge requirements).

### ✅ Longshot Angle Detection
The upset angle categories (pace devastation, class relief, equipment rescue, etc.) provide logical narrative for why a longshot might win, not just "it's a longshot."

### ✅ Diamond "Perfect Storm" Concept
Requiring multiple supporting factors (overlay + factors) for diamond classification prevents false positives from single-factor overlays.

### ✅ Extensive Error Handling
The codebase includes comprehensive null checks, fallback values, and logging throughout the scoring and recommendation pipeline.

---

## Detailed Analysis

### Section 1: Data Flow Analysis

```
DRF Data File (JSON)
    ↓
RaceHeader & HorseEntry parsing (types/drf.ts)
    ↓
Individual Scoring Modules:
  ├── calculateSpeedClassScore() → 0-50 pts
  ├── calculatePaceScore() → 0-40 pts
  ├── calculateDynamicConnectionsScore() → 0-50 pts
  ├── calculateFormScore() → 0-30 pts
  ├── calculateEquipmentScore() → 0-25 pts
  └── calculatePostPositionScore() → 0-45 pts
    ↓
calculateHorseScore() aggregation → 0-240 pts total
    ↓
Tier Classification (tierClassification.ts):
  ├── Tier 1: 180+ pts, 80%+ confidence
  ├── Tier 2: 160-179 pts, 60-79% confidence
  └── Tier 3: 140-159 pts, 25-60% confidence
    ↓
Value Analysis (valueDetector.ts):
  ├── Score → Win Probability (via calibration)
  ├── Odds → Market Probability
  ├── Edge = Our Prob - Market Prob
  └── EV% = EV per dollar × 100
    ↓
Overlay Calculation:
  ├── Adjusted Score = Score + (Overlay Bonus * multiplier)
  └── Sort horses by adjusted score
    ↓
Bet Generation (betGenerator.ts):
  ├── Tier 1 bets (win, place, exacta, trifecta)
  ├── Tier 2 bets (value focus, exacta keys)
  ├── Tier 3 bets (longshot bombs)
  └── Special categories (nuclear, diamond, value bomb)
    ↓
Bet Sizing (betSizing.ts):
  ├── Tier allocations by mode/style
  ├── Confidence multipliers
  └── Optional Kelly sizing
    ↓
Final Recommendations with amounts
```

### Section 2: Mathematical Review

#### 2.1 Score-to-Probability Conversion
**Formula**: Linear interpolation within tier bands
**Location**: `confidenceCalibration.ts:166-191`

```typescript
const interpolated = tier.winProbability + tierFraction * (nextTierProb - tier.winProbability);
```

**Assessment**: Reasonable approach, but bands should be validated empirically.

#### 2.2 Expected Value Calculation
**Formula**:
```
EV = (WinProb × NetPayout) - (LossProb × Stake)
EV = (p × (d-1)) - ((1-p) × 1)
```
where p = win probability, d = decimal odds

**Location**: `valueDetector.ts:342-358`

**Assessment**: Mathematically correct.

#### 2.3 Kelly Criterion
**Formula**:
```
f* = (bp - q) / b
```
where f* = fraction of bankroll, b = odds-1, p = win probability, q = 1-p

**Location**: `kellyCriterion.ts:75-99`

**Assessment**: Correctly implemented with fractional variants (quarter/half Kelly).

#### 2.4 Pace Pressure Index
**Formula**:
```
PPI = (earlySpeedCount / fieldSize) × 100
```

**Location**: `paceAnalysis.ts:343-346`

**Assessment**: Simple and intuitive. Consider weighting by early speed intensity.

#### 2.5 Overlay Percentage
**Formula**:
```
Overlay% = ((ActualOdds - FairOdds) / FairOdds) × 100
```

**Location**: `valueDetector.ts:372-380`

**Assessment**: Correct calculation.

### Section 3: Threshold Analysis

| Threshold | Location | Value | Purpose | Assessment |
|-----------|----------|-------|---------|------------|
| Tier 1 Score | tierClassification.ts | 180+ | Elite horse classification | May be too absolute |
| Tier 2 Score | tierClassification.ts | 160-179 | Value play classification | Reasonable |
| Tier 3 Score | tierClassification.ts | 140-159 | Longshot classification | Reasonable |
| Diamond Score Range | diamondTypes.ts | 120-139 | Hidden gem detection | Too narrow |
| Diamond Overlay Min | diamondTypes.ts | 200% | Minimum overlay for diamond | Appropriate |
| Longshot Odds Min | longshotTypes.ts | 25/1 | Minimum for longshot analysis | Standard |
| Nuclear Angle Points | longshotTypes.ts | 100+ | Nuclear classification | Appropriate |
| Live Angle Points | longshotTypes.ts | 60-99 | Live longshot | Appropriate |
| Elite EV Threshold | valueDetector.ts | 50%+ | Bet immediately | Very high |
| Strong EV Threshold | valueDetector.ts | 25-49% | Excellent bet | Appropriate |
| Moderate EV Threshold | valueDetector.ts | 10-24% | Good bet | Appropriate |
| Slight EV Threshold | valueDetector.ts | 5-9% | Playable | Appropriate |
| Soft Pace PPI | paceAnalysis.ts | <20 | Lone speed scenario | Appropriate |
| Speed Duel PPI | paceAnalysis.ts | 50+ | Pace collapse expected | Appropriate |

### Section 4: Bet Type Selection Logic

| Tier | Bet Types Generated | Logic |
|------|---------------------|-------|
| Tier 1 | Win (2x base), Place, Exacta Box (top 4), Exacta Key Over, Trifecta Box (top 4), Trifecta Key | All plays on high-confidence horse |
| Tier 2 | Win, Exacta Key Over/Under chalk, Trifecta Box with chalk, Quinella, Place (if 25%+ overlay) | Value-focused with chalk coverage |
| Tier 3 | Win (small), Exacta Key Over field, Superfecta box, Trifecta Wheel, Place | Bomb plays for massive payouts |
| Nuclear | Value Bomb (win) | $5 on 100+ angle pts, $2 on 60-99 |
| Diamond | Hidden Gem (win), Place saver | Based on factor count |

**Issues**:
1. 4-horse boxes are used regardless of score separation
2. No win-only strategy for clear standouts
3. Trifecta key with "MEDIUM+" horses may be too inclusive

### Section 5: Sizing Logic Review

| Mode | Tier 1 Allocation | Tier 2 | Tier 3 |
|------|-------------------|--------|--------|
| Safe | 70% | 30% | 0% |
| Balanced | 40% | 35% | 25% |
| Aggressive | 20% | 30% | 50% |

**Confidence Multipliers**:
- Elite (85%+): 2.0x
- Strong (75%+): 1.5x
- Good (65%+): 1.0x
- Fair (55%+): 0.75x
- Weak (<55%): 0.5x

**Assessment**: Reasonable structure but could benefit from Kelly integration at all levels.

### Section 6: Edge Cases Identified

1. **All horses scratched except 2-3**: Exotic bet logic may fail (need 4 for superfecta)
2. **No horses meet Tier 1 threshold**: All bets become Tier 2/3 focus
3. **Missing odds data**: Defaults to '5-1' which may be very wrong
4. **First-time starters**: Limited data leads to neutral scores
5. **Zero past performances**: Cannot calculate form, pace, or connections
6. **Extreme PPI (0 or 100)**: Pace scoring handles but may be unrealistic
7. **Duplicate program numbers**: Could cause mapping issues
8. **Very large fields (14+)**: Post position penalties may be excessive

---

## Proposed Fixes Summary

| Issue # | Priority | Problem | Fix | Complexity |
|---------|----------|---------|-----|------------|
| 1 | Critical | Uncalibrated probabilities | Implement result tracking | Medium |
| 2 | Critical | Fixed tier thresholds | Field-relative scoring | Medium |
| 3 | Critical | Morning line dependency | Live odds or warnings | Low-High |
| 4 | High | 4-horse box regardless of separation | Separation check | Low |
| 5 | High | Kelly only in Advanced | Fractional Kelly for all | Low |
| 6 | High | Conservative longshot probability | Adjust formula/cap | Low |
| 7 | High | No exotic leg correlation | Correlation adjustment | Medium |
| 8 | Medium | Form weight distribution | Bounce detection | Low |
| 9 | Medium | Pace score position blind | Lengths behind weighting | Medium |
| 10 | Medium | Class drop misses context | Track-tier adjustment | Medium |
| 11 | Medium | Narrow diamond range | Expand to 120-155 | Low |
| 12 | Medium | Equipment points uncalibrated | Outcome tracking | Medium |
| 13 | Low | Generic post position data | Confidence indicator | Low |
| 14 | Low | Limited connections sample | Persistent database | Medium |
| 15 | Low | Duplicate generation logic | Refactor to single pass | Low |

---

## Questions for Discussion

1. **Should tier thresholds be dynamic per race?** A 175-point horse in a weak maiden field may be a stronger play than a 180-point horse in a G1. Should we implement field-relative scoring?

2. **What is the actual win rate by score tier?** Without this data, all probability estimates are theoretical. Is there a way to track outcomes?

3. **How should morning line vs. live odds be handled?** If live odds aren't available, should we apply a wider confidence band to value calculations?

4. **Is the 4-horse exotic default optimal?** Analysis suggests 4-horse boxes catch more scenarios, but is the cost-to-probability ratio optimal?

5. **Should Kelly be the default rather than tier allocation?** Kelly naturally adjusts bet size to edge quality, which tier allocation doesn't.

6. **Are the longshot angle point values justified?** The 40/35/30/25 point values for different angles are arbitrary - should they be empirically derived?

7. **Should diamond detection extend into higher score ranges?** A 145-point horse with 300% overlay may be valuable but is currently excluded.

---

## Appendix: Code References

### Scoring Modules
- `src/lib/scoring/index.ts` - Main scoring orchestration
- `src/lib/scoring/baseScoring.ts` - Aggregate scoring (lines 1-400)
- `src/lib/scoring/speedClass.ts` - Speed/class (0-50 pts)
- `src/lib/scoring/pace.ts` - Pace scoring (0-40 pts)
- `src/lib/scoring/paceAnalysis.ts` - Detailed pace analysis
- `src/lib/scoring/connections.ts` - Trainer/jockey (0-50 pts)
- `src/lib/scoring/form.ts` - Recent form (0-30 pts)
- `src/lib/scoring/equipment.ts` - Equipment changes (0-25 pts)
- `src/lib/scoring/postPosition.ts` - Post position (0-45 pts)

### Betting Logic
- `src/lib/betting/betRecommendations.ts` - Bet recommendation structure
- `src/lib/betting/tierClassification.ts` - Horse tier classification
- `src/lib/betting/kellyCriterion.ts` - Kelly Criterion implementation

### Recommendation Generation
- `src/lib/recommendations/betGenerator.ts` - Main bet generation (1211 lines)
- `src/lib/recommendations/betSizing.ts` - Bet sizing logic

### Value Analysis
- `src/lib/value/valueBetting.ts` - Value betting framework
- `src/lib/value/valueDetector.ts` - EV and overlay calculations
- `src/lib/value/confidenceCalibration.ts` - Score-to-probability mapping

### Special Systems
- `src/lib/longshots/` - Nuclear longshot detection
- `src/lib/diamonds/` - Diamond in the rough detection
- `src/lib/exotics/` - Exotic bet cost calculations

### Types
- `src/types/drf.ts` - DRF data types (HorseEntry, RaceHeader, etc.)

---

*End of Audit Report*
