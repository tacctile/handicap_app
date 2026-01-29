# SCORING ENGINE

## The Complete Mathematical Scoring System

> **This document defines the universal scoring methodology applied to all horse racing analysis. Track-specific data (bias patterns, par times, trainer/jockey statistics) is supplied by the Track Intelligence Database and integrated dynamically.**

---

> ⚠️ **IMPORTANT: Algorithm Version Notice**
>
> The current implementation uses **Algorithm v4.0** with a **336-point base score** and **±40 overlay adjustment**.
>
> The detailed category sections below (Categories 1-6) document **v2.0 legacy scoring logic** for historical reference. For current implementation details, see **[ALGORITHM_REFERENCE.md](../../ALGORITHM_REFERENCE.md)**.
>
> The summary table immediately below reflects the current v4.0 weights. Form category (50 pts) now includes the Form Decay System. Combo patterns expanded to 10 pts.

---

## SCORING SYSTEM ARCHITECTURE

### Mathematical Foundation Principles

**The 336-point base system provides granular precision while maintaining track specificity:**

**Core Philosophy (v3.6 - Phase 7 Algorithm):**

- Speed figures as primary predictive factor (27.4% of base)
- Pace scenario analysis for race shape prediction
- Form decay system scales winner bonuses by recency (Phase 7)
- Track bias and post position as situational modifiers
- Odds factor incorporates market wisdom
- Connections and equipment as fine-tuning factors

**Weight Distribution Rationale (v4.0 - per ALGORITHM_REFERENCE.md):**

| Category         | Points | % of 336 | Rationale                               |
| ---------------- | ------ | -------- | --------------------------------------- |
| Speed & Class    | 140    | 41.7%    | Speed 105 + Class 35                    |
| Form             | 50     | 14.9%    | Form decay system scales winner bonuses |
| Pace             | 45     | 13.4%    | Consolidated base + scenario unified    |
| Connections      | 24     | 7.1%     | Jockey 12 + Trainer 10 + Partnership 2  |
| Distance/Surface | 20     | 6.0%     | Turf/Wet/Distance affinities            |
| Post Position    | 12     | 3.6%     | Track-dependent situational factor      |
| Track Specialist | 10     | 3.0%     | Proven success at today's track         |
| Combo Patterns   | 10     | 3.0%     | v4.0: Expanded from 4, range -6 to +10  |
| Trainer Patterns | 8      | 2.4%     | Situational trainer bonuses             |
| Equipment        | 8      | 2.4%     | Speculative, fine-tuning only           |
| Trainer S/D      | 6      | 1.8%     | Trainer surface/distance specialization |
| P3 Refinements   | 2      | 0.6%     | Age factor + Sire's Sire                |
| Weight           | 1      | 0.3%     | Subtle weight change refinement         |
| **TOTAL**        | 336    | 100%     |                                         |

**NOTE:** Odds Factor removed from base scoring to eliminate circular logic. Odds data still available for overlay calculations.

**Scoring Limits:**

- Base Score Maximum: 336 points
- Overlay Adjustment Range: ±40 points
- Final Score Cap: 376 points
- Minimum Betting Threshold: 131 points (Tier 3)
- Elite Betting Threshold: 181+ points (Tier 1)

---

## CATEGORY 1: CONNECTIONS ANALYSIS (25 POINTS MAXIMUM)

> **v2.0 Note:** Connections reduced from 55 to 25 points (10.4% of base) to reflect industry research showing this is a modifier rather than primary predictive factor.

### Trainer Evaluation Matrix (16 points maximum)

**Tier 1 Elite Trainers (20 points base):**

Elite trainers are identified through the Track Intelligence Database based on:

- Career Win Rate: 20%+ overall
- Track-Specific Win Rate: 23%+ at current track
- Specialty patterns (claiming, maiden, stakes)
- Equipment change success rates
- Layoff performance patterns

**Elite Trainer Scoring (rescaled for 16-point max):**

- Base Points: +10 (career 20%+ win rate)
- Track-Specific Bonus: +2 (23%+ at current track)
- Specialty Bonus: +1 to +2 (based on race type match)
- Pattern Match Bonus: +1 to +2 (situational advantages)
- Maximum Possible: 16 points

**Elite Trainer Situational Modifiers:**

- Horse making second start off claim: +5 additional points
- Horse getting blinkers for first time (if trainer has 35%+ success): +5 additional points
- Horse dropping into state-bred restricted race: +3 additional points
- Horse returning from 30-60 day layoff (if trainer pattern supports): +3 additional points

**Tier 2 Trainers (15 points base):**

- Base Points: +15 (proven winning trainer)
- Specialty bonuses apply based on race type match
- Maximum Possible: 22 points

**Tier 3 Claiming Specialists (Claiming Races Only):**

Claiming specialists override standard trainer scoring when:

- Claiming Race Win Rate: 40%+
- First Start After Claim Win Rate: 50%+
- Quick Turnaround Success: 45%+ within 7-14 days

**Claiming Specialist Scoring:**

- Base Points: +15 to +20 (based on claiming win rate)
- Bottom-Level Specialist: +5 (if 60%+ when dropping to bottom)
- Quick Turnaround Expert: +3 (if 55%+ within 7-14 days)
- Equipment Change Master: +3 (if 55%+ with equipment changes)
- First Start After Claim: +4 (if 65%+ win rate)
- Maximum Possible: 35 points (replaces other trainer scoring)

**Other Trainer Categories:**

- Local winning trainers (15-20% rate): +8 points
- Regional trainers (10-14% rate): +5 points
- Unknown trainers: 0 points
- Poor trainers (under 8%): -3 points

### Jockey Evaluation Matrix (7 points maximum)

**Premium Jockey (Track's Leading Rider, rescaled for 7-point max):**

- Base Points: +5 (20%+ current meet win rate)
- Track Mastery: +1 (22%+ career rate at track)
- Tactical Speed Preference: +1 (28%+ with early pressers)
- Maximum Possible: 7 points

**Premium Jockey Situational Bonuses:**

- Riding for elite trainer: +3 additional points (if 30%+ partnership rate)
- In sprint races (if sprint specialist): +2 additional points
- From optimal posts for track: +2 additional points

**Leading Riders (18%+ current meet rate):**

- Base Points: +8
- Tactical fit bonus: +2 (if riding style matches horse)
- Track experience: +1 (if established at track)
- Maximum Possible: 11 points

**Solid Local Riders (12-17% win rate):**

- Base Points: +5
- Experience bonus: +1 (if 3+ years at track)
- Trainer loyalty bonus: +1 (if regular for top trainer)
- Maximum Possible: 7 points

**Apprentice Riders:**

- Base Points: +3 (weight allowance value)
- Talent assessment: +2 (if showing promise)
- Bug boy bonus: +2 (if effective apprentice)
- Maximum Possible: 7 points

**Poor/Unknown Riders:**

- Base Points: 0
- Negative impact: -2 (if poor recent form)

---

## CATEGORY 2: POST POSITION & TRACK BIAS (30 POINTS MAXIMUM)

> **v2.0 Note:** Post Position reduced from 45 to 30 points (12.5% of base) as a track-dependent situational factor.

### Post Position Bias Matrix (27 points maximum)

> **Post position values are supplied by the Track Intelligence Database for each specific track. The scoring structure below applies universally.**

**Sprint Races (5.5F-7F) Scoring:**

**Golden Posts (Typically Posts 4-5 at most tracks, rescaled for 27-point max):**

- Golden Post 1: +27 points (highest win rate post)
- Golden Post 2: +21 points (second highest win rate)
- Tactical advantage: Perfect stalking position
- Ground saved: Optimal path to first turn
- Traffic avoidance: Clear run with maneuvering room

**Strong Posts (Typically Posts 2-3, 6-7):**

- Good Post: +21 points
- Neutral Post: +16 points
- Poor Post: +11 points

**Neutral/Weak Posts:**

- Terrible Post: +5 points (severe disadvantage)

**Route Races (1M-1 1/16M) Scoring:**

**Optimal Route Posts:**

- Best Route Post: +20 points (typically middle post)
- Save-Ground Posts: +15 points each (inside-middle)
- Good Position Posts: +12 points each (middle-outside)

**Marginal Route Posts:**

- Rail: +8 points (save ground but boxing concerns)
- Mid-Outside: +6 points each (manageable width)

**Penalty Posts:**

- Far Outside (10+): -5 points (excessive ground loss)

**Turf Races Scoring:**

- Outside Advantage Post: +20 points (typically far outside on turf)
- Strong Turf Posts: +15 points each
- Neutral Turf Posts: +10 points each
- Poor Turf Posts: +3 points each

### Track Bias Alignment Analysis (15 points maximum)

**Speed Bias Integration:**

Track bias data from Track Intelligence Database determines running style advantages:

**Perfect Bias Alignment:**

- Early speed from golden posts: +15 points
- Early speed from strong posts: +12 points
- Early speed from rail: +8 points

**Good Bias Alignment:**

- Early presser from optimal posts: +12 points
- Early presser from strong posts: +10 points
- Early presser from outside posts: +6 points

**Neutral Bias Alignment:**

- Mid-pack runners with superior class: +8 points
- Pressers with speed figure edge: +6 points

**Poor Bias Alignment:**

- Late closers without class edge: +2 points
- Deep closers from outside posts: 0 points
- Pure closers in speed-favoring conditions: -3 points

**Environmental Bias Adjustments:**

- Sealed track (after rain): +3 points to speed types
- Cuppy track (drying out): +2 points to late runners
- Frozen track: +5 points to speed types
- Extreme heat: -2 points to front-runners
- High winds: +3 points to inside posts

---

## CATEGORY 3: SPEED FIGURES & CLASS MASTERY (80 POINTS MAXIMUM)

> **v2.0 Note:** Speed/Class increased from 50 to 80 points (33.3% of base) as the most predictive factor per industry research.

### Speed Figure Evaluation Matrix (48 points maximum)

**Elite Speed Figure Category (10+ above par, rescaled for 48-point max):**

- Elite figures 10+ above par: +48 points
- Strong figures 5-9 above par: +40 points
- Good figures at par: +32 points

**Acceptable Speed Figure Category:**

- Slightly below par (1-5 below): +24 points
- Below par (6-10 below): +16 points

**Poor Speed Figure Category:**

- Significantly below par (11+ below): +8 points
- No figures available: +24 points (neutral)

**Speed Figure Modifiers:**

- Track record speed figure: +5 bonus points
- Lifetime best speed figure: +3 bonus points
- Speed figure achieved at current track: +2 bonus points
- Speed figure on similar track condition: +2 bonus points

### Speed Recency Decay (v3.7)

> **v3.7 Note:** Speed figure recency decay has been re-enabled with calibrated tiers that are GENTLER than Form Decay. Speed figures represent ability (stable), while form represents current condition (volatile).

**Speed Recency Decay Tiers:**

| Days Since Race | Multiplier | Description   |
| --------------- | ---------- | ------------- |
| 0-30 days       | 1.00x      | Full credit   |
| 31-60 days      | 0.95x      | 5% reduction  |
| 61-90 days      | 0.85x      | 15% reduction |
| 91-120 days     | 0.75x      | 25% reduction |
| 121-180 days    | 0.60x      | 40% reduction |
| 181+ days       | 0.45x      | 55% reduction |

**Active Horse Protection:**

To prevent penalizing active horses with old standout figures:

- Horse is "active" if it has 3+ speed figures in the last 90 days
- Old figures (>90 days) use the best multiplier from recent figures
- Example: A 95 Beyer from 150 days ago, when horse also has an 88 from 20 days ago:
  - Normal decay would give the 95 a 0.60x multiplier (very stale)
  - Active protection uses the 1.0x multiplier from the recent 88
  - Result: Old career-best retains full value for frequently racing horses

**Comparison: Speed vs Form Decay:**

| Days   | Speed Decay | Form Decay |
| ------ | ----------- | ---------- |
| 0-30   | 1.00x       | 1.00x      |
| 31-60  | 0.95x       | 0.65-0.85x |
| 61-90  | 0.85x       | 0.25-0.40x |
| 91-120 | 0.75x       | 0.10x      |
| 121+   | 0.45-0.60x  | 0.10x      |

Speed decay is gentler because ability is more stable than current condition.

### Speed Figure Progression Analysis (10 points maximum)

**Improvement Patterns:**

- Three straight improving figures: +8 points
- Two straight improving figures: +5 points
- Last race significant improvement: +3 points

**Consistency Patterns:**

- Figures within 3 points last 5 races: +5 points
- Figures within 5 points last 5 races: +3 points

**Decline Patterns:**

- Three straight declining figures: -5 points
- Significant recent decline (8+ points): -8 points
- Erratic pattern (15+ point swings): -3 points

**Figure Reliability Factors:**

- Achieved on same surface: +2 points
- Achieved at same distance: +2 points
- Achieved in similar class: +2 points
- Achieved in similar conditions: +1 point

### Class Level Appropriateness (32 points maximum)

**Perfect Class Fit (rescaled for 32-point max):**

- Proven winner at current level: +32 points
- Competitive at level (multiple ITM): +24 points
- Class drop with valid excuse: +29 points
- Simple class drop: +26 points

**Neutral Class Position:**

- Rising in class, competitive last: +19 points
- Rising in class, testing: +16 points
- Placed at level, seeking first win: +19 points
- First-time starter (unknown): +16 points

**Unfavorable Class Position:**

- Struggling at current level: +8 points
- Competitive but unproven: +16 points

**Class Movement Bonuses:**

- Dropping 25%+ in class with stable figures: +5 bonus points
- Moving from allowance to claiming with excuse: +3 bonus points
- State-bred moving to restricted race: +3 bonus points

---

## CATEGORY 4: FORM CYCLE & CONDITIONING (50 POINTS MAXIMUM)

> **v3.6 Note:** Form category updated to 50 pts with decay system. Winner bonuses now scale by recency to address Algorithm Audit Finding #1 — 53% of bad picks had stale form.

### Form Decay System (v3.6)

The Form Decay system scales winner bonuses based on how recently the horse won, preventing stale form from being overvalued.

**Won Last Out (WLO) Decay Tiers:**

| Days Since Win | Points | Description     |
| -------------- | ------ | --------------- |
| 0-21 days      | +18    | Hot winner      |
| 22-35 days     | +14    | Recent winner   |
| 36-50 days     | +10    | Freshening      |
| 51-75 days     | +6     | Stale           |
| 76-90 days     | +3     | Very stale      |
| 91+ days       | +1     | Ancient history |

**Pattern Bonus Decay Multipliers:**

Applied to Won 2 of 3 and Won 3 of 5 patterns based on most recent win date:

| Days Since Win | Multiplier |
| -------------- | ---------- |
| 0-21 days      | 1.00x      |
| 22-35 days     | 0.85x      |
| 36-50 days     | 0.65x      |
| 51-75 days     | 0.40x      |
| 76-90 days     | 0.25x      |
| 91+ days       | 0.10x      |

**Base Pattern Values (before multiplier):**

- Won 2 of 3: +8 pts base
- Won 3 of 5: +4 pts base

**Form Decay Calculation Examples:**

- **Horse A** won 14 days ago: +18 pts WLO (hot winner tier)
- **Horse B** won 45 days ago: +10 pts WLO (freshening tier)
- **Horse C** won 100 days ago: +1 pt WLO (ancient history tier)
- **Horse D** won 2 of 3, most recent win 30 days ago: +8 × 0.85 = +6.8 pts → **+7 pts** (rounded)

**Form Category Cap:** 50 pts maximum

Maximum possible from decay system: WLO (18) + Won 2/3 (8) + Won 3/5 (4) = 30 pts, leaving 20 pts for other form factors (layoff, consistency, recent finish position). Cap is enforced.

### Recent Performance Analysis (20 points maximum)

**Excellent Recent Form (rescaled for 20-point max):**

- Won last race: +20 points
- 2nd within 2 lengths: +16 points
- 3rd within 2 lengths: +15 points

**Strong Recent Form:**

- 2nd (more than 2 lengths): +13 points
- 3rd (more than 2 lengths): +12 points
- 4th-5th competitive effort: +11 points

**Acceptable Recent Form:**

- 4th-5th less competitive: +8 points
- 6th-8th: +5 points
- First starter (neutral): +11 points

**Poor Recent Form:**

- Poor effort (9th+): +4 points

### Layoff Analysis Matrix (13 points maximum)

**Optimal Layoff Ranges (rescaled for 13-point max):**

- 7-35 days (optimal freshness): +13 points
- 36-60 days (short freshening): +9 points
- Quick turnback (<7 days): +8 points

**Acceptable Layoff Ranges:**

- 61-90 days (moderate layoff): +5 points
- First-time starter: +7 points

**Concerning Layoff Ranges:**

- 90+ days with layoff win history: +7 points
- 90+ days without layoff wins: 0 points

### Consistency & Reliability Factors (7 points maximum)

**Consistency Bonuses (rescaled for 7-point max):**

- 3+ straight ITM finishes (hot streak): +7 points
- 2 consecutive ITM finishes: +4 points
- ITM last out: +1 point
- 4/5 ITM in recent races: +4 points

**No Consistency Pattern:**

- No streak or consistency: 0 points

---

## CATEGORY 5: EQUIPMENT & MEDICATION (20 POINTS MAXIMUM)

> **v2.0 Note:** Equipment reduced from 25 to 20 points (8.3% of base) as speculative fine-tuning factor.

### Equipment Change Analysis (12 points maximum)

**High-Impact Equipment Changes (rescaled for 20-point max):**

- First-time Lasix with trainer success pattern: +10 to +16 points
- Blinkers ON for first time: +8 to +13 points
- Blinkers OFF after duel/pace issues: +6 to +12 points

**Moderate Equipment Changes:**

- Tongue tie for breathing issues: +4 to +6 points
- Equipment previously successful: +3 points
- Trainer's positive equipment pattern: +2 points

**Minor Equipment Changes:**

- Bandage changes: +1 to +2 points
- Bit changes: +1 point

**Base Score (no changes):**

- No equipment changes: +8 points (base)

### Medication Patterns (5 points maximum)

**Beneficial Medication Patterns:**

- First-time Lasix with proven success pattern: +5 points
- Optimal medication timing: +3 points
- Medication proven effective for horse: +2 points

**Standard Medication Usage:**

- Routine Lasix usage: +1 point
- Consistent medication pattern: 0 points

### Shoeing & Surface Preparation (5 points maximum)

**Optimal Shoeing for Conditions:**

- Appropriate shoes for track condition: +3 points
- Proven shoeing pattern for horse: +2 points
- Pads for track protection: +2 points
- Mud caulks for wet conditions: +3 points

---

## CATEGORY 6: PACE & TACTICAL ANALYSIS (45 POINTS MAXIMUM)

> **v2.0 Note:** Pace increased from 40 to 45 points (18.8% of base) to reflect high predictive value of race shape analysis.

### Pace Scenario Evaluation (28 points maximum, rescaled)

**Lone Speed Scenarios (1 clear speed horse):**

- The lone speed horse: +28 points
- Early pressers positioned behind: +17 points
- Mid-pack horses: +9 points
- Closers: +6 points

**Soft Pace Scenarios (No true speed in field):**

- Any horse with tactical speed: +23 points
- Early types with average figures: +17 points
- Pressers who can inherit lead: +14 points
- Closers face significant disadvantage: +3 points

**Honest Pace Scenarios (2-3 speed horses):**

- Early pressers: +23 points
- Quality speed horses: +17 points
- Mid-pack stalkers: +14 points
- Closers with class edge: +9 points

**Hot Pace Scenarios (4+ speed horses):**

- Deep closers with class: +28 points
- Stalkers with late kick: +23 points
- Mid-pack runners: +17 points
- Pure speed horses: +6 points

### Tactical Advantages Analysis (17 points maximum, rescaled)

**Perfect Tactical Setup:**

- Pace scenario perfectly suits running style: +17 points
- Post position enhances tactical approach: +14 points
- Field size optimal for tactics: +11 points

**Tactical Flexibility Bonuses:**

- Horse can adapt to multiple scenarios: +9 points
- Proven tactical speed when needed: +7 points
- Ability to rate or go forward: +6 points

**Tactical Concerns:**

- One-dimensional running style: +2 points
- Poor tactical position likely: 0 points
- Running style fights expected pace: -5 points

---

## MATHEMATICAL INTEGRATION & VERIFICATION

### Scoring Calculation Protocol

**Base Score Computation (v2.0 Industry-Aligned Weights):**

1. Category 3 (Speed/Class): 0-80 points (33.3%)
2. Category 6 (Pace/Tactical): 0-45 points (18.8%)
3. Category 4 (Form/Condition): 0-40 points (16.7%)
4. Category 2 (Post/Bias): 0-30 points (12.5%)
5. Category 1 (Connections): 0-25 points (10.4%)
6. Category 5 (Equipment/Medication): 0-20 points (8.3%)

**Total Base Score Range: 0-336 points (see ALGORITHM_REFERENCE.md)**

### Track-Specific Adjustments

**Track Specialization Bonuses:**

- Horse with multiple wins at current track: +5 points
- Horse bred in track's state: +3 points
- Local stable (based at track): +2 points
- Proven in current track conditions: +3 points

**Environmental Integration:**

- Weather favor for running style: +5 points
- Track condition suits horse perfectly: +5 points
- Seasonal timing optimal: +3 points

### Track Condition Integration (v1.1)

**NEW:** Track condition selection now dynamically affects scoring in real-time. Available conditions are surface-aware:

**Dirt Conditions (best to worst):**

- Fast → Good → Slow → Muddy → Sloppy → Heavy

**Turf Conditions (best to worst):**

- Firm → Good → Yielding → Soft → Heavy

**Track Condition Scoring Impact:**

- Wet track conditions trigger mudder/non-mudder analysis
- Off-track bonuses/penalties applied based on horse's wet track history
- Drainage factor amplifies wet track importance at poorly draining tracks

### Seasonal Speed Adjustments (v1.1)

**NEW:** Speed figures are now adjusted based on seasonal patterns from Track Intelligence Database.

```
Adjusted Speed Score = Base Speed Score + Seasonal Adjustment (±3 points max)

Seasonal Factors:
- Track playing fast (summer, dry): +1 to +3 points
- Track playing slow (winter, wet): -1 to -3 points
- Normal conditions: No adjustment
```

| Season/Pattern     | Speed Figure Adjustment |
| ------------------ | ----------------------- |
| Peak summer (fast) | +2 to +3 points         |
| Normal conditions  | 0 points                |
| Winter (slow)      | -1 to -2 points         |
| Rainy season       | -2 to -3 points         |

The system automatically detects the current month and applies track-specific seasonal patterns.

### Quality Control Verification

**Mandatory Checks Before Final Score:**

- Verify all category totals sum correctly
- Confirm no double-counting of factors
- Validate pace scenario logic
- Check post position assignments
- Verify trainer/jockey point allocation
- Confirm equipment change accuracy

**Score Reasonableness Test:**

- Elite horses (proven winners): 180+ points expected
- Competitive horses: 140-179 points range
- Marginal horses: 100-139 points range
- Non-competitive horses: Under 100 points

---

## SCORE CATEGORIZATION MATRIX

### Final Score Interpretation

**Elite Tier (200+ Final Points):**

- Characteristics: Multiple elite factors aligned
- Expected Probability Range: 35-60% win chance
- Betting Confidence: Maximum
- Typical Odds Range: 6/5 to 3/1

**Strong Tier (180-199 Final Points):**

- Characteristics: Strong foundation with good overlay
- Expected Probability Range: 25-35% win chance
- Betting Confidence: High
- Typical Odds Range: 5/2 to 4/1

**Competitive Tier (160-179 Final Points):**

- Characteristics: Solid contender with advantages
- Expected Probability Range: 15-25% win chance
- Betting Confidence: Moderate to High
- Typical Odds Range: 4/1 to 6/1

**Marginal Tier (140-159 Final Points):**

- Characteristics: Minimum betting threshold
- Expected Probability Range: 8-15% win chance
- Betting Confidence: Moderate
- Typical Odds Range: 6/1 to 12/1

**Non-Competitive Tier (Under 140 Final Points):**

- Characteristics: Insufficient advantages for betting
- Expected Probability Range: Under 8% win chance
- Betting Confidence: None (Pass)
- Typical Odds Range: 12/1 and higher

---

> **NOTE:** The detailed category sections above document the v2.0 scoring logic for reference. The actual implementation uses Algorithm v4.0 as documented in **[ALGORITHM_REFERENCE.md](../../ALGORITHM_REFERENCE.md)**, which has a 336-point base with 14 categories (odds removed from base scoring), form decay system, and data completeness penalties.

---

_Document Version: 4.0_
_Last Updated: January 2026_
_Status: Track-Agnostic Universal Scoring Engine_
_Integration: Requires Track Intelligence Database for track-specific values_
_Changes in v4.0: Combo patterns expanded to 10 pts, odds removed from base scoring, base now 336._
_Changes in v3.7: Speed Recency Decay — re-enabled with calibrated tiers (Phase 8). Active Horse Protection added._
_Changes in v3.6: Form Decay System — scales winner bonuses by recency (Phase 7). Form cap 50 pts._
_Changes in v3.1: Algorithm rebuild. See ALGORITHM_REFERENCE.md for complete category breakdown._
_Changes in v3.0: Phase 3 speed rebalance (90 pts), base increased to 313._
_Changes in v2.5: Overlay system added with ±50 cap._
_Changes in v2.0: Rebalanced category weights to align with industry handicapping research._
_Changes in v1.1: Added track condition real-time integration, seasonal speed adjustments._
