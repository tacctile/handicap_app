# Furlong Scoring Algorithm v3.6

## Overview

The Furlong scoring algorithm v3.6 represents a complete rebuild through Phases 1-7, focusing on:

- Speed figures as the dominant predictive factor (27.4% of base)
- Form decay system to scale winner bonuses by recency (Phase 7)
- Market wisdom incorporation via odds factor
- Missing data penalties for low-confidence horses
- Proven horse protection to prevent favorites from being destroyed by pace overlay
- Reduced and capped overlay adjustments

**Score Ranges:**

- MAX_BASE_SCORE: 331 points
- MAX_OVERLAY: ±40 points
- MAX_TOTAL: 371 points
- Practical Range: 50 to 320 points

## Category Weights

| Category         | Points | % of Base | Description                                   |
| ---------------- | ------ | --------- | --------------------------------------------- |
| Speed Figures    | 90     | 27.4%     | Most predictive factor - Beyer/TimeformUS     |
| Form             | 50     | 15.2%     | Recent performance + winner bonuses (+20 WLO) |
| Pace             | 45     | 13.7%     | Race shape analysis and pace scenarios        |
| Class            | 32     | 9.8%      | Class movement and competition level          |
| Connections      | 27     | 8.2%      | Trainer + jockey + partnership bonuses        |
| Distance/Surface | 20     | 6.1%      | Turf (8) + Wet (6) + Distance (6) affinities  |
| Odds Factor      | 15     | 4.6%      | Market wisdom for favorites (Phase 6)         |
| Post Position    | 12     | 3.7%      | Track-dependent positional advantage          |
| Trainer Patterns | 10     | 3.0%      | Situational trainer stat bonuses              |
| Equipment        | 8      | 2.4%      | First-time Lasix, blinkers changes            |
| Track Specialist | 6      | 1.8%      | Proven success at today's track               |
| Trainer S/D      | 6      | 1.8%      | Trainer surface/distance specialization       |
| Combo Patterns   | 4      | 1.2%      | Jockey/trainer combination bonuses            |
| P3 Refinements   | 2      | 0.6%      | Age factor (±1) + Sire's Sire (±1)            |
| Weight           | 1      | 0.3%      | Subtle weight change refinement               |
| **TOTAL**        | 331    | 100%      |                                               |

## Key Changes from v2.5

### Phase 1: Data Completeness Infrastructure

- Implemented critical/important/minor field classification
- Added data completeness scoring (0-100%)
- Defined low confidence threshold (<75%)

### Phase 2: Missing Data Penalties

- FTS/lightly-raced horses get reduced base scores
- Low confidence penalty: 15% reduction to base score
- Prevents unknown horses from over-scoring

### Phase 3: Speed Weight Rebalance

- Speed figures: 48 → 90 pts (16.5% → 27.4%)
- Post position: 20 → 12 pts (reduced per industry research)
- Equipment: 12 → 8 pts (proportional reduction)
- Trainer patterns: 15 → 10 pts (proportional reduction)
- Combo patterns: 6 → 4 pts (proportional reduction)

### Phase 4: Winner Bonus Boost

- Won Last Out (WLO): +8 → +20 pts
- Won 2 of 3: +4 → +8 pts
- Won 3 of 5: +2 → +4 pts
- Recent winners now dominate form scoring

### Phase 5: Pace Overlay Nerf

- Pace overlay max: ±20 → ±10 pts
- Overall overlay cap: ±50 → ±40 pts
- Proven horse protection: 50% reduction on pace penalties for high-scoring horses (base ≥180)

### Phase 6: Odds Factor

- Added 0-15 pt category based on morning line / live odds
- Heavy favorite (1-1 or lower): 15 pts
- Strong favorite (5-2 to 3-1): 12 pts
- Low favorite (4-1 to 5-1): 10 pts
- Contender (6-1 to 10-1): 8 pts
- Mid-odds (11-1 to 15-1): 6 pts
- Longer (16-1 to 24-1): 5 pts
- Longshot (25-1 or higher): 3 pts

### Phase 7: Form Decay System (v3.6)

**Rationale:** Addresses Algorithm Audit Finding #1 — 53% of bad picks had stale form. Horses that won 90 days ago were receiving the same bonus as horses that won 14 days ago. Decay fixes this by scaling winner bonuses based on recency.

**Won Last Out (WLO) Decay:**

| Days Since Win | Points | Description     |
| -------------- | ------ | --------------- |
| 0-21 days      | +18    | Hot winner      |
| 22-35 days     | +14    | Recent winner   |
| 36-50 days     | +10    | Freshening      |
| 51-75 days     | +6     | Stale           |
| 76-90 days     | +3     | Very stale      |
| 91+ days       | +1     | Ancient history |

**Pattern Bonus Decay:**

Pattern bonuses (Won 2 of 3, Won 3 of 5) apply a recency multiplier based on most recent win date:

| Days Since Win | Multiplier | Description       |
| -------------- | ---------- | ----------------- |
| 0-21 days      | 1.00x      | Full credit       |
| 22-35 days     | 0.85x      | Slight discount   |
| 36-50 days     | 0.65x      | Moderate decay    |
| 51-75 days     | 0.40x      | Significant decay |
| 76-90 days     | 0.25x      | Heavy decay       |
| 91+ days       | 0.10x      | Minimal credit    |

**Base Pattern Values (before multiplier):**

- Won 2 of 3: +8 pts base
- Won 3 of 5: +4 pts base

**Form Category Cap:** 50 pts maximum (unchanged from v3.1)

**Maximum Form Score Calculation (v3.6):**

- WLO (hot winner, 0-21 days): +18 pts
- Won 2 of 3 (1.0x multiplier): +8 pts
- Won 3 of 5 (1.0x multiplier): +4 pts
- Other form factors (layoff, consistency): up to +20 pts
- **Total possible: 50 pts** (cap enforced)

## Data Completeness System

### Critical Fields (50% weight)

- Speed figures (Beyer/TimeformUS)
- Past performances (finish positions)
- Class levels raced
- Days since last race

### Important Fields (35% weight)

- Running style / early speed
- Track/distance experience
- Trainer/jockey information
- Workout data

### Minor Fields (15% weight)

- Weight changes
- Equipment changes
- Medication changes

### Confidence Levels

- HIGH (80-100%): Full scoring confidence
- MEDIUM (60-79%): Minor adjustments may apply
- LOW (<60%): 15% base score penalty applied

## Proven Horse Protection

Horses with base scores ≥180 (proven contenders) receive reduced pace penalties:

- 50% reduction on all pace overlay penalties
- Prevents favorites from being destroyed in speed duel scenarios
- Max pace penalty for proven E horse in speed duel: -4 pts (was -8)

This ensures that horses the algorithm rates highly aren't unfairly penalized by pace overlay adjustments, which are refinements rather than primary predictors.

## Overlay System (±40 pts)

| Section                         | Max | Description                           |
| ------------------------------- | --- | ------------------------------------- |
| A: Pace Dynamics & Bias         | ±10 | Speed duel/pace scenario adjustments  |
| B: Form Cycle & Conditioning    | ±15 | Bounce, freshening, pattern detection |
| C: Trip Analysis & Trouble      | ±10 | Historical trouble, wide trips        |
| D: Class Movement & Competition | ±12 | Drops/raises, hidden class changes    |
| E: Connection Micro-Edges       | ±8  | Trainer/jockey hot streaks            |
| F: Distance & Surface Opt.      | ±6  | Surface switch, distance optimization |
| G: Head-to-Head & Tactical      | ±6  | Prior matchup results, tactical edges |

**Total Overlay Cap: ±40 pts**

## Scoring Philosophy

1. **Speed is King**: Speed figures account for 27.4% of base score, reflecting industry research that shows speed is the most predictive factor.

2. **Winners Rewarded**: A horse that just won should score high in form. The +20 pt WLO bonus ensures this.

3. **Market Wisdom**: The odds factor incorporates collective market intelligence, giving 12-15 pts to horses the public believes will contend.

4. **Penalty for Unknowns**: Missing data is penalized, not treated as neutral. FTS horses score significantly lower than proven runners.

5. **Overlay = Refinement**: The overlay system fine-tunes scores but doesn't override base analysis. The ±40 pt cap ensures this.

6. **Protect Proven Horses**: High-scoring horses get reduced pace penalties because they've earned their score through demonstrated ability.

## Score Interpretation

| Score Range | Tier   | Description                               |
| ----------- | ------ | ----------------------------------------- |
| 200+        | Elite  | Top contenders, likely win/place          |
| 180-199     | Strong | Solid contenders, competitive             |
| 160-179     | Good   | Can compete, need favorable scenario      |
| 140-159     | Fair   | Minimum betting threshold, longshot value |
| <140        | Weak   | Not recommended for betting               |

## Diagnostic Output

Use `generateRaceDiagnostic()` from `src/lib/scoring/diagnostics.ts` to get full category breakdowns for validation. The diagnostic includes:

- All category scores
- Base score, overlay adjustment, total score
- Data completeness grade
- Low confidence flags
- Predicted finish position

### Phase 8: Speed Recency Decay (v3.7)

**Rationale:** Algorithm Audit found that Speed Recency Decay was DISABLED in v3.3, meaning a 95 Beyer from 180 days ago was treated identically to one from 14 days ago. With v3.6 Form Decay now handling current condition, Speed Decay can address the separate concern of whether old figures still reflect current ability.

**Speed Recency Decay Tiers (v3.7):**

| Days Since Race | Multiplier | Description   |
| --------------- | ---------- | ------------- |
| 0-30 days       | 1.00       | Full credit   |
| 31-60 days      | 0.95       | 5% reduction  |
| 61-90 days      | 0.85       | 15% reduction |
| 91-120 days     | 0.75       | 25% reduction |
| 121-180 days    | 0.60       | 40% reduction |
| 181+ days       | 0.45       | 55% reduction |

**Why Gentler Than Form Decay:**

- Speed figures represent ABILITY (more stable over time)
- Form represents CURRENT CONDITION (more volatile)
- A horse can maintain ability while temporarily losing form
- Speed decay: 1.00 → 0.45 (55% range)
- Form decay: 1.00 → 0.10 (90% range)

**Active Horse Protection (v3.7):**

To prevent penalizing active horses with old standout figures:

- If horse has 3+ speed figures in last 90 days, it's "active"
- Old figures (>90 days) use the best multiplier from recent figures
- This allows old career-bests to retain value for frequently racing horses

**Example:**

- Horse A: 95 Beyer from 150 days ago, 88 Beyer from 20 days ago
- The 88 from 20 days = 1.0x multiplier (recent)
- Active horse: Yes (has recent figure)
- The old 95 uses 1.0x instead of 0.60x (protected)
- Result: Old standout figure isn't heavily penalized

## Version History

- **v3.7** (Phase 8): Speed Recency Decay — re-enabled with calibrated tiers and active horse protection
- **v3.6** (Phase 7): Form Decay System — scales winner bonuses by recency
- **v3.1** (Phase 6): Added odds factor (+15 pts), base now 331
- **v3.0** (Phase 3): Speed rebalance, base increased to 313
- **v2.5**: Overlay system added, cap at ±50
- **v2.0**: Industry-aligned weights, 240-point base
- **v1.0**: Initial scoring implementation
