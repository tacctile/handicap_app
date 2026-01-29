# Handicap App — Algorithm Reference

> **Single source of truth for all scoring algorithm values.**
>
> **Audience:** Claude Chat (planning) AND Claude Code (execution)
>
> **Read with MASTER_CONTEXT.md at the start of every session.**
>
> **Last Updated:** January 2026

---

## Toolchain Declaration

| Tool              | Purpose                             |
| ----------------- | ----------------------------------- |
| Claude Chat       | Brainstorming and prompt generation |
| Claude Code (Web) | Code execution                      |
| GitHub            | Repository (tacctile/handicap_app)  |
| Vercel            | Deployments                         |

**NOTHING IS EVER DONE LOCALLY.**

---

## Base Score Categories

| Category                 | Max Points | % of Base | Source File                                             |
| ------------------------ | ---------- | --------- | ------------------------------------------------------- |
| Speed & Class            | 140        | 42.4%     | speedClass.ts                                           |
| Form                     | 50         | 15.2%     | form.ts                                                 |
| Pace                     | 45         | 13.6%     | pace.ts (CONSOLIDATED)                                  |
| Connections              | 24         | 7.3%      | connections.ts (Jockey 12 + Trainer 10 + Partnership 2) |
| Distance/Surface         | 20         | 6.1%      | distanceSurface.ts                                      |
| Post Position            | 12         | 3.6%      | postPosition.ts                                         |
| Track Specialist         | 10         | 3.0%      | distanceSurface.ts                                      |
| Equipment                | 8          | 2.4%      | equipment.ts                                            |
| Trainer Patterns         | 8          | 2.4%      | trainerPatterns.ts                                      |
| Trainer Surface/Distance | 6          | 1.8%      | connections.ts                                          |
| Combo Patterns           | 4          | 1.2%      | comboPatterns.ts                                        |
| Age Factor               | ±1         | 0.3%      | p3Refinements.ts                                        |
| Sire's Sire              | ±1         | 0.3%      | p3Refinements.ts                                        |
| Weight                   | 1          | 0.3%      | weight.ts                                               |
| **TOTAL**                | **330**    | **100%**  | index.ts                                                |

> **NOTE:** Odds Factor (12 pts) removed from base scoring to eliminate circular logic.
> Odds data still available for overlay calculations.

| Constant       | Value | Source   |
| -------------- | ----- | -------- |
| MAX_BASE_SCORE | 330   | index.ts |
| MAX_OVERLAY    | ±40   | index.ts |
| MAX_SCORE      | 370   | index.ts |

---

## Speed Score (0-105 points)

| Differential to Par | Points | Description    |
| ------------------- | ------ | -------------- |
| ≥+10                | 105    | Elite          |
| +7 to +9            | 95     | Strong         |
| +4 to +6            | 80     | Good           |
| +1 to +3            | 70     | Above par      |
| 0                   | 55     | At par         |
| -1 to -3            | 45     | Slightly below |
| -4 to -6            | 35     | Below par      |
| -7 to -9            | 25     | Well below     |
| ≤-10                | 15     | Far below par  |

### Speed Recency Decay

| Days Since Race | Multiplier | Description    |
| --------------- | ---------- | -------------- |
| 0-30            | 1.00       | Full credit    |
| 31-60           | 0.95       | Still relevant |
| 61-90           | 0.85       | Getting stale  |
| 91-120          | 0.75       | Stale          |
| 121-180         | 0.60       | Very stale     |
| 181+            | 0.45       | Ancient        |

### Speed Confidence Multiplier

| Figure Count (last 3) | Multiplier |
| --------------------- | ---------- |
| 3+ figures            | 1.0        |
| 2 figures             | 0.75       |
| 1 figure              | 0.375      |
| 0 figures             | 0.25       |

---

## Class Score (0-35 points)

| Scenario                      | Points |
| ----------------------------- | ------ |
| Proven winner at level        | 35     |
| Class drop with excuse        | 32     |
| Simple class drop             | 28     |
| Competitive at level (2+ ITM) | 26     |
| Rising, competitive last out  | 21     |
| Placed at level               | 21     |
| First-time starter            | 17     |
| Rising in class               | 17     |
| Overmatched                   | 9      |

### Sale Price Bonus (≤5 starts)

| Sale Price        | Bonus | Tier          |
| ----------------- | ----- | ------------- |
| $500,000+         | +8    | Elite         |
| $200,000-$499,999 | +6    | High-End      |
| $100,000-$199,999 | +4    | Above Average |
| $50,000-$99,999   | +2    | Solid         |
| $20,000-$49,999   | +1    | Average       |
| <$20,000          | 0     | Bargain       |

### Class Par Figures

| Classification              | Par Beyer |
| --------------------------- | --------- |
| maiden-claiming             | 65        |
| maiden                      | 72        |
| claiming                    | 75        |
| starter-allowance           | 78        |
| allowance                   | 82        |
| allowance-optional-claiming | 85        |
| handicap                    | 88        |
| stakes                      | 90        |
| stakes-listed               | 93        |
| stakes-graded-3             | 96        |
| stakes-graded-2             | 100       |
| stakes-graded-1             | 105       |

---

## Form Score (0-50 points)

### Recent Performance Base

| Finish Position           | Points |
| ------------------------- | ------ |
| 1st                       | 15     |
| 2nd within 2L             | 12     |
| 3rd within 2L             | 12     |
| 2nd >2L                   | 9      |
| 3rd >2L                   | 9      |
| 4th-5th competitive (<5L) | 7      |
| 4th-5th                   | 5      |
| 6th-8th                   | 4      |
| 9th+                      | 3      |

### WLO Decay Schedule

| Days Since Win | Points | Description     |
| -------------- | ------ | --------------- |
| 0-21           | 18     | Hot winner      |
| 22-35          | 14     | Recent winner   |
| 36-50          | 10     | Freshening      |
| 51-75          | 6      | Stale           |
| 76-90          | 3      | Very stale      |
| 91+            | 1      | Ancient history |

### Pattern Bonus Multiplier

| Days Since Win | Multiplier |
| -------------- | ---------- |
| 0-21           | 1.00       |
| 22-35          | 0.85       |
| 36-50          | 0.65       |
| 51-75          | 0.40       |
| 76-90          | 0.25       |
| 91+            | 0.10       |

### Pattern Bonuses (base × multiplier)

| Pattern    | Base Points |
| ---------- | ----------- |
| Won 2 of 3 | 8           |
| Won 3 of 5 | 4           |

### Win Recency Bonus

| Condition          | Points |
| ------------------ | ------ |
| Won within 30 days | +4     |
| Won within 60 days | +3     |

### Conditional Winner Bonus (v3.7)

Additive bonus based on win recency AND class comparison. Replaces the unconditional 15-point floor.
Stacks WITH WLO decay - these bonuses add to the calculated form score, not replace it.

| Win Position | Class vs Today   | Bonus |
| ------------ | ---------------- | ----- |
| Last race    | Same or higher   | +3    |
| Last race    | Lower (moving up)| +1    |
| 2 races back | Same or higher   | +2    |
| 2 races back | Lower            | +0    |
| 3+ back      | Any              | +0    |

> **v3.7 CHANGE:** Removed unconditional 15-point winner protection floor.
> The old system gave ANY last-out winner a minimum 15 pts regardless of quality.
> A $10K claimer win 4 races ago shouldn't protect when facing allowance company.

### Consistency Points

| ITM Rate (last 10) | Points |
| ------------------ | ------ |
| ≥50%               | 4      |
| 40-49%             | 3      |
| 30-39%             | 2      |
| 20-29%             | 1      |
| <20%               | 0      |
| 3+ consecutive ITM | 4      |

### Layoff Penalties

| Days Since Race           | Penalty |
| ------------------------- | ------- |
| 7-35 (optimal)            | 0       |
| <7 (quick turnback)       | -2      |
| 36-60                     | -3      |
| 61-90                     | -6      |
| 90+                       | -10     |
| First-time starter        | -2      |
| Long layoff but won fresh | -5      |

| Constant                              | Value |
| ------------------------------------- | ----- |
| MAX_LAYOFF_PENALTY                    | 10    |
| CONDITIONAL_WINNER_BONUS_LAST_SAME    | 3     |
| CONDITIONAL_WINNER_BONUS_LAST_LOWER   | 1     |
| CONDITIONAL_WINNER_BONUS_2BACK_SAME   | 2     |
| CONDITIONAL_WINNER_BONUS_2BACK_LOWER  | 0     |

> **REMOVED:** MIN_FORM_SCORE_FOR_RECENT_WINNER (was 15) - replaced by conditional bonus system

### Form Confidence Multiplier

| PP Count    | Multiplier | Max Possible |
| ----------- | ---------- | ------------ |
| 3+ PPs      | 1.0        | 50 pts       |
| 2 PPs       | 0.6        | 30 pts       |
| 1 PP        | 0.4        | 20 pts       |
| 0 PPs (FTS) | 0.2        | 10 pts       |

---

## Pace Score (0-35 points)

### Tactical Fit Scoring

| Fit Level | Base Score | Description             |
| --------- | ---------- | ----------------------- |
| Perfect   | 22+        | Lone speed in soft pace |
| Good      | 16-21      | Presser in hot pace     |
| Neutral   | 11-15      | Mixed fit               |
| Poor      | 5-10       | Closer in soft pace     |
| Terrible  | 0-4        | Worst matchup           |

### Pace Confidence Multiplier

| Data Available         | Multiplier |
| ---------------------- | ---------- |
| EP1/LP + running style | 1.0        |
| EP1/LP only            | 0.75       |
| Running style only     | 0.5        |
| Neither                | 0.35       |

### Track Bias Adjustments

| Condition                       | Running Style | Adjustment |
| ------------------------------- | ------------- | ---------- |
| Extreme speed track (rating 8+) | E             | +5         |
| Strong speed track (rating 7)   | E             | +2         |
| Extreme speed track             | C             | -2         |
| Closer-friendly (rating ≤3)     | C             | +4         |
| Closer-friendly                 | E             | -2         |
| Speed track (rating ≥7)         | P             | +2         |
| Fair-closing (rating ≤4)        | S             | +2         |

---

## Connections Score (0-24 points)

| Component   | Max Points |
| ----------- | ---------- |
| Jockey      | 12         |
| Trainer     | 10         |
| Partnership | 2          |
| **Total**   | **24**     |

> **REBALANCE RATIONALE:** Academic studies show jockeys account for 8-12% of outcome variance.
> Elite jockeys provide measurable 6-8 length advantages. Previous jockey weight (5 pts, 1.5%)
> was severely underweighted. Flipped jockey:trainer ratio from 5:16 to 12:10.

### Jockey Scoring Tiers (0-12 pts)

| Win Rate | Min Starts | Points |
| -------- | ---------- | ------ |
| ≥25%     | 20+        | 12     |
| ≥22%     | 15+        | 10     |
| ≥20%     | 10+        | 8      |
| ≥17%     | 10+        | 6      |
| ≥15%     | 5+         | 5      |
| ≥12%     | 5+         | 4      |
| ≥10%     | any        | 3      |
| <10%     | any        | 1      |

### Trainer Scoring Tiers (0-10 pts)

| Win Rate | Min Starts | Points |
| -------- | ---------- | ------ |
| ≥25%     | 20+        | 10     |
| ≥22%     | 15+        | 8      |
| ≥20%     | 10+        | 7      |
| ≥17%     | 10+        | 5      |
| ≥15%     | 5+         | 4      |
| ≥12%     | 5+         | 3      |
| ≥10%     | any        | 2      |
| <10%     | any        | 1      |

### Partnership Tiers

| Tier   | Criteria                   | Points |
| ------ | -------------------------- | ------ |
| Elite  | ≥30% win rate, 8+ starts   | 2      |
| Strong | 25-29% win rate, 5+ starts | 1      |
| Other  | Below thresholds           | 0      |

| Constant                     | Value |
| ---------------------------- | ----- |
| Jockey Shipper Cap           | 8     |
| Trainer Shipper Cap          | 7     |
| Trainer Surface/Distance Max | 6     |

---

## Overlay System

| Section | Name                             | Max Cap |
| ------- | -------------------------------- | ------- |
| A       | Pace Dynamics & Bias             | ±10     |
| B       | Form Cycle & Conditioning        | ±15     |
| C       | Trip Analysis & Trouble          | ±10     |
| D       | Class Movement & Competition     | ±12     |
| E       | Connection Micro-Edges           | ±8      |
| F       | Distance & Surface Optimization  | ±6      |
| G       | Head-to-Head & Tactical Matchups | ±6      |

| Constant                | Value                                      |
| ----------------------- | ------------------------------------------ |
| MAX_OVERLAY_BONUS       | 40                                         |
| MAX_OVERLAY_PENALTY     | -40                                        |
| Proven Horse Threshold  | baseScore ≥180                             |
| Proven Horse Protection | 50% reduction on negative pace adjustments |

---

## Data Tier Weights

| Tier     | Weight | Fields                                                                        |
| -------- | ------ | ----------------------------------------------------------------------------- |
| Critical | 50%    | Speed figures, Past performances, Finish positions, Class level               |
| High     | 30%    | Trainer stats, Jockey stats, Running style, Days since last race, Workouts    |
| Medium   | 15%    | Pace figures, Track record, Distance record, Surface record                   |
| Low      | 5%     | Trainer category stats, Equipment, Breeding, Weight changes, Claiming history |

### Data Completeness Grades

| Grade | Score Range |
| ----- | ----------- |
| A     | ≥90%        |
| B     | ≥75%        |
| C     | ≥60%        |
| D     | ≥40%        |
| F     | <40%        |

| Constant                 | Value                       |
| ------------------------ | --------------------------- |
| LOW_CONFIDENCE_THRESHOLD | 75% (criticalComplete)      |
| Low Confidence Penalty   | 15% reduction to base score |

---

## Tier Classification

| Tier   | Name                 | Min Score | Max Score | Min Confidence |
| ------ | -------------------- | --------- | --------- | -------------- |
| Tier 1 | Cover Chalk          | 178       | 240       | 70%            |
| Tier 2 | Logical Alternatives | 158       | 177       | 60%            |
| Tier 3 | Value Bombs          | 129       | 157       | 40%            |

> Thresholds: 54%, 48%, 39% of MAX_BASE_SCORE (330)

### Confidence Formula

```
confidence = 40 + (baseScore / 330) * 60
```

### Expected Hit Rates

| Tier   | Win% | Place% | Show% |
| ------ | ---- | ------ | ----- |
| Tier 1 | 35%  | 55%    | 70%   |
| Tier 2 | 18%  | 35%    | 50%   |
| Tier 3 | 8%   | 18%    | 28%   |

### Special Cases

| Case                       | Criteria                          | Action                     |
| -------------------------- | --------------------------------- | -------------------------- |
| Diamond in Rough           | Score 140-170 + 150%+ overlay     | Force Tier 2               |
| Fool's Gold                | High score + significant underlay | Demote from Tier 1         |
| Tier 3 Overlay Requirement | Minimum 25% overlay               | Required for consideration |

---

## DRF Field Index

### Race Header Fields (1-27)

| Field | Index | Description          |
| ----- | ----- | -------------------- |
| 1     | 0     | Track Code           |
| 2     | 1     | Race Date (YYYYMMDD) |
| 3     | 2     | Race Number          |
| 4     | 3     | Post Position        |
| 6     | 5     | Post Time (military) |
| 7     | 6     | Surface Code (D/T/S) |
| 9     | 8     | Distance Code (S/R)  |
| 10    | 9     | Race Type Code       |
| 11    | 10    | Race Name/Conditions |
| 12    | 11    | Purse Amount         |
| 15    | 14    | Distance (furlongs)  |
| 24    | 23    | Field Size           |

### Horse Identity Fields (28-57)

| Field | Index | Description                   |
| ----- | ----- | ----------------------------- |
| 28    | 27    | Trainer Name                  |
| 29    | 28    | Trainer Starts (current meet) |
| 30    | 29    | Trainer Wins (current meet)   |
| 31    | 30    | Trainer Places (current meet) |
| 32    | 31    | Trainer Shows (current meet)  |
| 33    | 32    | Jockey Name                   |
| 35    | 34    | Jockey Starts (current meet)  |
| 36    | 35    | Jockey Wins (current meet)    |
| 37    | 36    | Jockey Places (current meet)  |
| 38    | 37    | Jockey Shows (current meet)   |
| 39    | 38    | Owner Name                    |
| 43    | 42    | Program Number                |
| 44    | 43    | Morning Line Odds             |
| 45    | 44    | Horse Name                    |
| 46    | 45    | Age (years)                   |
| 47    | 46    | Age (months)                  |
| 49    | 48    | Sex Code                      |
| 50    | 49    | Color                         |
| 51    | 50    | Weight (assigned)             |
| 52    | 51    | Sire Name                     |
| 53    | 52    | Sire's Sire                   |
| 54    | 53    | Dam Name                      |
| 55    | 54    | Dam's Sire                    |
| 56    | 55    | Breeder Name                  |
| 57    | 56    | State/Country Bred            |

### Lifetime Records (70-101)

| Field | Index | Description            |
| ----- | ----- | ---------------------- |
| 70    | 69    | Current Year Starts    |
| 71    | 70    | Current Year Wins      |
| 72    | 71    | Current Year Places    |
| 73    | 72    | Current Year Shows     |
| 74    | 73    | Current Year Earnings  |
| 75    | 74    | Previous Year Starts   |
| 76    | 75    | Previous Year Wins     |
| 77    | 76    | Previous Year Places   |
| 78    | 77    | Previous Year Shows    |
| 79    | 78    | Previous Year Earnings |
| 80    | 79    | Track Starts           |
| 81    | 80    | Track Wins             |
| 82    | 81    | Track Places           |
| 83    | 82    | Track Shows            |
| 84    | 83    | Track Earnings         |
| 97    | 96    | Lifetime Starts        |
| 98    | 97    | Lifetime Wins          |
| 99    | 98    | Lifetime Places        |
| 100   | 99    | Lifetime Shows         |
| 101   | 100   | Lifetime Earnings      |

### Running Style & Speed (210-225)

| Field | Index | Description                      |
| ----- | ----- | -------------------------------- |
| 210   | 209   | Running Style Code (E/E-P/P/S/C) |
| 211   | 210   | Speed Points                     |
| 224   | 223   | Best Speed Figure                |

### Speed & Pace Figures (766-865)

| Field Range | Start Index | Description            |
| ----------- | ----------- | ---------------------- |
| 766-775     | 765         | PP Beyer Speed Figures |
| 776-785     | 775         | PP Track Variant       |
| 816-825     | 815         | PP Early Pace (EP1)    |
| 846-855     | 845         | PP Late Pace           |
| 856-865     | 855         | PP Average Pace        |

### Fractional Times (866-945)

| Field Range | Start Index | Description         |
| ----------- | ----------- | ------------------- |
| 866-875     | 865         | Quarter time (2f)   |
| 896-905     | 895         | Half-mile time (4f) |
| 906-915     | 905         | Six furlong time    |
| 916-925     | 915         | Mile time           |

### Past Performance Ranges

| Data Type      | Field Range | Start Index |
| -------------- | ----------- | ----------- |
| PP Dates       | 102-113     | 101         |
| PP Track Codes | 126-137     | 125         |
| PP Conditions  | 150-161     | 149         |
| PP Equipment   | 162-173     | 161         |
| PP Trainer     | 1056-1065   | 1055        |
| PP Jockey      | 1066-1075   | 1065        |
| Trainer Stats  | 1146-1221   | 1145        |
| Sale Price     | 1222        | 1221        |
| Sale Location  | 1223        | 1222        |
| Trip Notes     | 1383-1392   | 1382        |

---

## Track Intelligence

### Track Data Structure

| Data Point  | Description         | Example Values                         |
| ----------- | ------------------- | -------------------------------------- |
| code        | Track identifier    | "KEE", "SA", "CD"                      |
| name        | Full track name     | "Keeneland Race Course"                |
| location    | City, State         | "Lexington, Kentucky"                  |
| state       | State abbreviation  | "KY"                                   |
| dataQuality | Verification status | "verified", "preliminary", "estimated" |

### Track Measurements

| Data Point    | Description        | Example (Keeneland) |
| ------------- | ------------------ | ------------------- |
| circumference | Miles              | 1.0625              |
| stretchLength | Feet               | 1174                |
| turnRadius    | Feet               | 285                 |
| trackWidth    | Feet               | 80                  |
| chutes        | Furlongs available | [4.5, 6, 7]         |

### Post Position Bias Structure

| Data Point       | Description              |
| ---------------- | ------------------------ |
| distance         | "sprint" or "route"      |
| minFurlongs      | Minimum distance         |
| maxFurlongs      | Maximum distance         |
| winPercentByPost | Array (index 0 = post 1) |
| favoredPosts     | 1-indexed array          |
| biasDescription  | Text summary             |

### Speed Bias Structure

| Data Point          | Description                                |
| ------------------- | ------------------------------------------ |
| surface             | "dirt", "turf", "synthetic", "all-weather" |
| earlySpeedWinRate   | Percentage                                 |
| paceAdvantageRating | 1-10 scale                                 |
| description         | Text summary                               |

### Seasonal Pattern Structure

| Data Point         | Description                          |
| ------------------ | ------------------------------------ |
| season             | "winter", "spring", "summer", "fall" |
| months             | Array of month numbers               |
| typicalCondition   | Expected track state                 |
| speedAdjustment    | ± adjustment value                   |
| favoredStyle       | "E", "P", "C", or null               |
| styleBiasMagnitude | 0-3 scale                            |

---

## Recalculation Triggers

| Trigger                | Change Type | Effect                |
| ---------------------- | ----------- | --------------------- |
| Track Condition Change | score       | Full recalculation    |
| Horse Scratched        | score       | Full recalculation    |
| Horse Unscratched      | score       | Full recalculation    |
| Odds Updated           | odds        | Overlay recalculation |
| Odds Reset             | odds        | Overlay recalculation |
| Full Reset             | score       | Full recalculation    |
| Session Restored       | score       | Full recalculation    |

| Constant           | Value      |
| ------------------ | ---------- |
| Debounce Delay     | 300ms      |
| History Max Length | 50 entries |

---

## Score Display Thresholds

| Tier      | Min Score | % of Base |
| --------- | --------- | --------- |
| Elite     | 265+      | 82%+      |
| Strong    | 216-264   | 67-81%    |
| Contender | 165-215   | 51-66%    |
| Fair      | 116-164   | 36-50%    |
| Weak      | <116      | <36%      |

---

## Bias Inflation Cap

| Constant                 | Value                                                 |
| ------------------------ | ----------------------------------------------------- |
| Ability Score Components | Speed + Class + Form + Pace                           |
| Bias Score Components    | Connections + Post Position + Odds + Trainer Patterns |
| Max Bias Allowed         | Ability Score × 0.25                                  |

---

## Paper Tiger Circuit Breaker

| Condition                              | Effect                  |
| -------------------------------------- | ----------------------- |
| High Speed + Poor Form + Mediocre Pace | Tiered penalty          |
| Recent winner (WLO or 2 of 3)          | Protected from penalty  |
| Elite pace (≥30)                       | Tessuto Rule protection |

---

## Key Race Index Bonus

| Constant                    | Value |
| --------------------------- | ----- |
| MAX_KEY_RACE_BONUS          | 6     |
| MAX_PP_TO_ANALYZE           | 10    |
| MIN_RANK_FOR_BONUS          | Top 4 |
| POINTS_BEHIND_TOP_2         | 2     |
| POINTS_BEHIND_TOP_4         | 1     |
| POINTS_4TH_5TH_BEHIND_TOP_2 | 1     |

---

## Methodology Reference

For detailed methodology documentation, read src/docs/ directly.

---

_End of ALGORITHM_REFERENCE.md_
