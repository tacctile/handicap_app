# Furlong Scoring Algorithm v3.1

## Overview

The Furlong scoring algorithm v3.1 represents a complete rebuild through Phases 1-6, focusing on:

- Speed figures as the dominant predictive factor (27.4% of base)
- Enhanced winner bonuses (+20 pts for WLO)
- Market wisdom incorporation via odds factor
- Missing data penalties for low-confidence horses
- Proven horse protection to prevent favorites from being destroyed by pace overlay
- Reduced and capped overlay adjustments

**Score Ranges:**

- MAX_BASE_SCORE: 328 points
- MAX_OVERLAY: ±40 points
- MAX_TOTAL: 368 points
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
| **TOTAL**        | 328    | 100%      |                                               |

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

## Version History

- **v3.1** (Phase 6): Added odds factor (+15 pts), base now 328
- **v3.0** (Phase 3): Speed rebalance, base increased to 313
- **v2.5**: Overlay system added, cap at ±50
- **v2.0**: Industry-aligned weights, 240-point base
- **v1.0**: Initial scoring implementation
