# OVERLAY SYSTEM

## The ±50 Point Micro-Edge Capture Protocol

> **The Overlay System transforms the static base score into a dynamic, race-specific assessment. Every DRF data point contributes to overlay calculation, capturing micro-edges that accumulate into significant advantages.**

---

## OVERLAY SYSTEM ARCHITECTURE

### Foundational Principles

**The DRF Overlay transforms the static base score into a dynamic, race-specific assessment:**

**Core Philosophy:**

- Base score identifies historically profitable patterns
- Overlay captures race-day specific advantages/disadvantages
- Every DRF data point contributes to overlay calculation
- Micro-edges accumulate into significant advantages
- Track-specific patterns prioritized via Track Intelligence Database

**Adjustment Parameters:**

- Maximum Positive Adjustment: +50 points
- Maximum Negative Adjustment: -50 points
- Overflow beyond ±50 recorded as confidence modifier
- Minimum threshold for betting consideration: Base + Overlay ≥ 140 points

### Overlay Section Distribution

| Section                             | Maximum Adjustment       |
| ----------------------------------- | ------------------------ |
| A: Pace Dynamics & Bias             | ±20 points               |
| B: Form Cycle & Conditioning        | ±15 points               |
| C: Trip Analysis & Trouble          | ±12 points               |
| D: Class Movement & Competition     | ±15 points               |
| E: Connection Micro-Edges           | ±10 points               |
| F: Distance & Surface Optimization  | ±8 points                |
| G: Head-to-Head & Tactical Matchups | ±8 points                |
| H: Market Intelligence              | Confidence modifier only |

**Raw Overlay Range:** -88 to +88 points (before cap)
**Capped Overlay Range:** -50 to +50 points (applied to score)
**Overflow:** Recorded as confidence modifier

---

## SECTION A: PACE DYNAMICS & BIAS INTEGRATION (±20 POINTS)

### Comprehensive Pace Analysis Protocol

**Step 1: Calculate Pace Pressure Index (PPI)**

```
PPI = Sum of Quirin Pace Points (QPP) for top 4 speed horses

Pace Scenario Classification:
- Hot Pace: PPI ≥ 28 (4+ horses with early speed)
- Moderate-Hot Pace: PPI 22-27 (3 horses with speed)
- Honest Pace: PPI 16-21 (2 horses with speed)
- Soft Pace: PPI 10-15 (1 horse with clear speed)
- Dead Pace: PPI ≤ 9 (no early speed in field)
```

**Step 2: Early Pace Figure Analysis**

Using EP1 (Early Pace) figures from DRF:

- Identify horses with EP1 under 75 (true speed)
- Calculate average EP1 of speed horses
- Determine pace pressure based on quantity and quality
- Assess tactical speed distribution through field

**Step 3: Pace Scenario Scoring Adjustments**

### Hot Pace Scenario (PPI ≥ 28)

| Running Style         | Adjustment |
| --------------------- | ---------- |
| Pure speed (E)        | -8 points  |
| Early pressers (EP)   | +5 points  |
| Mid-pack pressers (P) | +12 points |
| Stalkers (S)          | +15 points |
| Deep closers (C)      | +20 points |

### Moderate-Hot Pace (PPI 22-27)

| Running Style         | Adjustment |
| --------------------- | ---------- |
| Pure speed (E)        | -3 points  |
| Early pressers (EP)   | +8 points  |
| Mid-pack pressers (P) | +10 points |
| Stalkers (S)          | +12 points |
| Deep closers (C)      | +8 points  |

### Honest Pace Scenario (PPI 16-21)

| Running Style         | Adjustment |
| --------------------- | ---------- |
| Pure speed (E)        | +5 points  |
| Early pressers (EP)   | +10 points |
| Mid-pack pressers (P) | +8 points  |
| Stalkers (S)          | +5 points  |
| Deep closers (C)      | +3 points  |

### Soft Pace Scenario (PPI 10-15)

| Running Style         | Adjustment |
| --------------------- | ---------- |
| Pure speed (E)        | +15 points |
| Early pressers (EP)   | +12 points |
| Mid-pack pressers (P) | +5 points  |
| Stalkers (S)          | +2 points  |
| Deep closers (C)      | -5 points  |

### Dead Pace Scenario (PPI ≤ 9)

| Running Style                       | Adjustment |
| ----------------------------------- | ---------- |
| Any horse with tactical speed       | +20 points |
| Horses capable of early positioning | +15 points |
| Pure closers                        | -10 points |

### Special Pace Scenario Bonuses

**Lone Speed Analysis:**

If exactly one horse has EP1 under 75 AND next fastest is 5+ points slower:

- Lone speed horse: +15 additional points
- All other horses: Assess based on ability to pressure or pass

**Speed Duel Detection:**

If 2 horses have similar EP1 figures (within 2 points) and both under 75:

- Both speed horses: -5 points (mutual destruction likely)
- Early pressers behind them: +8 points
- Mid-pack runners: +12 points

**Pace Advantage by Post Position:**

- Inside speed (posts 1-3) in soft pace: +5 additional points
- Outside speed (posts 6+) in hot pace: -3 points (trapped wide)
- Middle posts (4-5) perfect for any pace scenario: +3 points

### Stretch Length Factor Integration

**NEW (v1.1):** Closer scoring is now adjusted based on track-specific stretch length from Track Intelligence Database.

```
Stretch Length Impact:
- Long stretch (1100+ ft): Closers get +2 to +6 bonus points
- Average stretch (1000-1099 ft): Standard scoring
- Short stretch (900-999 ft): Closers get -2 to -4 penalty
- Very short stretch (<900 ft): Closers get -4 to -6 penalty

Speed Horse Benefit:
- Short stretch (<900 ft): Speed horses get +1 to +4 bonus
```

| Stretch Length | Closer Adjustment | Speed Adjustment |
| -------------- | ----------------- | ---------------- |
| Long (1100+ft) | +4 to +6 points   | No adjustment    |
| Average        | +1 to +2 points   | No adjustment    |
| Short (900ft)  | -2 to -4 points   | +1 to +2 points  |
| Very Short     | -4 to -6 points   | +2 to +4 points  |

**Example:** A deep closer at Belmont (1097ft stretch) gets approximately +5 points. The same closer at a bullring with 850ft stretch gets -5 points.

### Track Bias Integration with Current Conditions

**Weekly Bias Calculation:**

```
Bias Index = (E + EP Win%) - (P + S Win%) for last 7 days at distance

Classification:
- Strong Speed Bias: BI ≥ +40
- Moderate Speed Bias: BI +20 to +39
- Neutral Bias: BI -19 to +19
- Moderate Closing Bias: BI -20 to -39
- Strong Closing Bias: BI ≤ -40
```

**Bias Adjustments Applied to Base Pace Scoring:**

| Bias Type             | E/EP Adjustment | S/C Adjustment |
| --------------------- | --------------- | -------------- |
| Strong Speed Bias     | +8 points       | -8 points      |
| Moderate Speed Bias   | +5 points       | -5 points      |
| Neutral Bias          | No adjustment   | No adjustment  |
| Moderate Closing Bias | -5 points       | +5 points      |
| Strong Closing Bias   | -8 points       | +8 points      |

---

## SECTION B: FORM CYCLE & CONDITIONING DYNAMICS (±15 POINTS)

### Advanced Form Analysis Protocol

**Speed Figure Trajectory Analysis:**

Last 4 Races Pattern Recognition:

| Pattern                                         | Adjustment |
| ----------------------------------------------- | ---------- |
| Consistent improvement (3+ points each race)    | +12 points |
| Strong recent improvement (5+ points last race) | +8 points  |
| Moderate improvement trend                      | +5 points  |
| Maintaining high level (within 2 points)        | +3 points  |
| Slight decline pattern                          | -2 points  |
| Significant decline (5+ points)                 | -8 points  |
| Erratic pattern (10+ point swings)              | -5 points  |

**Class-Adjusted Figure Analysis:**

- Convert raw figures to class-adjusted ratings
- Compare to par for today's class level
- Assess figure reliability across class changes
- Evaluate figure progression with class movement

### Layoff Impact Integration

**Optimal Layoff Performance (21-56 days):**

| Workout Pattern          | Adjustment |
| ------------------------ | ---------- |
| Strong workout pattern   | +8 points  |
| Moderate workout pattern | +5 points  |
| Poor workout pattern     | 0 points   |

**Short Rest (7-20 days):**

| Last Effort           | Adjustment |
| --------------------- | ---------- |
| After strong effort   | +5 points  |
| After moderate effort | +2 points  |
| After poor effort     | -3 points  |

**Extended Layoff (57+ days):**

| Workout Pattern                        | Adjustment |
| -------------------------------------- | ---------- |
| Bullet workout within 14 days          | +3 points  |
| Steady workout pattern                 | 0 points   |
| Poor workout pattern                   | -8 points  |
| Trainer's layoff success pattern match | ±3 points  |

### Workout Pattern Analysis

**Workout Quality Assessment:**

| Pattern                       | Adjustment |
| ----------------------------- | ---------- |
| Bullet workout within 14 days | +8 points  |
| Multiple bullets in 30 days   | +10 points |
| Consistent work pattern       | +5 points  |
| Work regression pattern       | -5 points  |
| Missing expected works        | -8 points  |

**Workout Content Analysis:**

- Gate work for speed horses: +3 points
- Breezing vs. handily patterns: +2 points
- Company quality in works: +3 points
- Work surface matching race surface: +2 points

**Trainer-Specific Work Patterns:**

- Deviation from trainer's normal pattern: ±5 points
- Trainer's success with current pattern: +3 points
- Work pattern indicates specific targeting: +5 points

### Physical Condition Indicators

**Weight Management Analysis:**

| Condition                               | Adjustment |
| --------------------------------------- | ---------- |
| Consistent weight maintenance           | +3 points  |
| Recent weight gain (improved condition) | +5 points  |
| Recent weight loss (concern)            | -5 points  |
| Optimal weight for horse's frame        | +2 points  |

**Seasonal Form Patterns:**

| Pattern                             | Adjustment |
| ----------------------------------- | ---------- |
| Horse racing in optimal season      | +5 points  |
| Historical monthly performance peak | +3 points  |
| Seasonal decline pattern            | -3 points  |
| First race back from winter break   | +2 points  |
| Peak fitness period for horse       | +5 points  |

---

## SECTION C: TRIP ANALYSIS & TROUBLE EVALUATION (±12 POINTS)

### Comprehensive Trip Note Analysis

**Major Trouble Categories (High-Impact Excuses):**

**Severe Traffic/Interference:**

| Trip Note                            | Adjustment |
| ------------------------------------ | ---------- |
| "Checked hard," "pulled up sharply"  | +10 points |
| "Blocked," "no room," "shut off"     | +8 points  |
| "Steadied repeatedly," "bumped hard" | +6 points  |
| "Clipped heels," "stumbled badly"    | +8 points  |

**Wide Trip Disadvantages:**

| Trip Note                          | Adjustment                  |
| ---------------------------------- | --------------------------- |
| "5-wide turn," "6-wide throughout" | +6 points                   |
| "4-wide turn," "wide trip"         | +4 points                   |
| "Carried wide," "forced wide"      | +5 points                   |
| Ground loss calculated             | +1 point per 2 lengths lost |

**Pace-Related Excuses:**

| Trip Note                               | Adjustment |
| --------------------------------------- | ---------- |
| "Hustled early," "pressured throughout" | +5 points  |
| "Dueled to half," "contested pace"      | +4 points  |
| "Rushed up," "used early"               | +3 points  |

**Equipment/Rider Issues:**

| Trip Note                           | Adjustment |
| ----------------------------------- | ---------- |
| "Lost rider," "equipment failure"   | +8 points  |
| "Lugged in/out," "bearing in/out"   | +3 points  |
| "Reared at start," "dwelt at break" | +4 points  |

### Trip Note Validation Process

**Cross-Reference with Performance:**

| Scenario                            | Points Applied      |
| ----------------------------------- | ------------------- |
| Trouble with competitive final time | Full points awarded |
| Trouble with poor final time        | 50% points awarded  |
| Trouble with terrible final time    | 25% points awarded  |

**Video Review Correlation:**

- Chart caller accuracy assessment
- Severity of trouble confirmation
- Alternative explanations for poor performance

**Pattern Recognition:**

| Pattern                              | Adjustment      |
| ------------------------------------ | --------------- |
| Repeated trouble patterns            | +2 bonus points |
| Trouble-free trips with poor results | -3 points       |
| Horse's ability to overcome trouble  | +2 points       |

### Positive Trip Factors

**Ideal Trip Scenarios:**

| Trip Note                          | Adjustment                     |
| ---------------------------------- | ------------------------------ |
| "Perfect trip," "saved ground"     | -2 points (no excuse for loss) |
| "Tracked winner," "ideal position" | -1 point                       |
| "Clear sailing," "good trip"       | 0 points                       |

**Trip Advantage Recognition:**

| Trip Note                              | Adjustment                |
| -------------------------------------- | ------------------------- |
| "Benefited from pace," "perfect setup" | -3 points                 |
| "Got through on rail," "inside save"   | +1 point (but note setup) |

---

## SECTION D: CLASS MOVEMENT & COMPETITIVE ANALYSIS (±15 POINTS)

### Hidden Class Change Detection

**Claiming Activity Analysis:**

| Scenario                                      | Adjustment |
| --------------------------------------------- | ---------- |
| Claimed last start by elite barn              | +8 points  |
| Claimed by barn with specific success pattern | +6 points  |
| Claimed and immediately equipment change      | +10 points |
| Claimed and dropping in next start            | +5 points  |

**Protected Claiming Situations:**

| Scenario                                     | Adjustment |
| -------------------------------------------- | ---------- |
| Entered for tag but not claimed (overpriced) | +3 points  |
| Multiple entries without claims (protected)  | 0 points   |
| Claimed but protected by high price          | -2 points  |

**Class Relief Scenarios:**

| Scenario                             | Adjustment           |
| ------------------------------------ | -------------------- |
| Dropping from stakes to allowance    | +10 points           |
| Dropping from allowance to claiming  | +8 points            |
| Dropping within claiming levels 25%+ | +6 points            |
| Dropping with valid excuse           | +5 additional points |

### Key Race Analysis Matrix

**Next-Out Winner Calculation:**

```
Key Race Index (KRI) = Number of next-out winners from horse's last race

Parameters:
- Time Frame: 45 days maximum
- Class Level: Equal or higher class only
- Surface Consistency: Same surface preferred
```

**KRI Scoring System:**

| KRI Value | Adjustment | Description                    |
| --------- | ---------- | ------------------------------ |
| KRI 5+    | +12 points | Exceptionally strong form race |
| KRI 4     | +10 points | Very strong form race          |
| KRI 3     | +8 points  | Strong form race               |
| KRI 2     | +5 points  | Decent form race               |
| KRI 1     | +2 points  | Weak form race                 |
| KRI 0     | -3 points  | Poor form race                 |

**Form Race Quality Assessment:**

- Average class of next-out winners
- Speed figures of next-out winners
- Margins of victory in next-out races
- Timeframe of next-out success

### Competitive Context Evaluation

**Field Strength Analysis:**

| Field Strength               | Adjustment |
| ---------------------------- | ---------- |
| Above-average field strength | -3 points  |
| Below-average field strength | +5 points  |
| Weak field for class level   | +8 points  |
| Exceptionally strong field   | -8 points  |

**Pace Competition Assessment:**

| Scenario                          | Adjustment |
| --------------------------------- | ---------- |
| Horse's style matches few others  | +5 points  |
| Horse's style heavily represented | -3 points  |
| Tactical speed advantage          | +3 points  |

---

## SECTION E: CONNECTION MICRO-EDGES (±10 POINTS)

### Jockey Switch Analysis

**Upgrade Detection:**

| Scenario                                         | Adjustment |
| ------------------------------------------------ | ---------- |
| Switch to jockey with 5%+ higher win rate        | +5 points  |
| Switch to jockey with strong trainer partnership | +3 points  |
| Switch to specialist for distance/surface        | +4 points  |
| Switch to hot jockey (recent strong form)        | +3 points  |

**Downgrade Detection:**

| Scenario                                 | Adjustment |
| ---------------------------------------- | ---------- |
| Switch to jockey with 5%+ lower win rate | -5 points  |
| Switch off successful partnership        | -3 points  |
| Switch to inexperienced rider            | -2 points  |

**Tactical Jockey Matching:**

| Scenario                           | Adjustment |
| ---------------------------------- | ---------- |
| Jockey style matches horse's needs | +3 points  |
| Jockey poor fit for horse's style  | -3 points  |
| Jockey's post position success     | +2 points  |

### Trainer Intent Signals

**High Confidence Indicators:**

| Signal                                       | Adjustment |
| -------------------------------------------- | ---------- |
| First start off claim for successful claimer | +8 points  |
| Second start off layoff for specialist       | +6 points  |
| Equipment change with proven success pattern | +5 points  |
| Barn "in form" (hot streak)                  | +4 points  |

**Low Confidence Indicators:**

| Signal                              | Adjustment |
| ----------------------------------- | ---------- |
| Trainer cold streak (0 for 20+)     | -5 points  |
| Unusual entry pattern for trainer   | -3 points  |
| Trainer rarely wins with this angle | -4 points  |

**Strategic Placement Signals:**

| Signal                               | Adjustment |
| ------------------------------------ | ---------- |
| Perfect spot for horse's limitations | +5 points  |
| Aggressive spot (reaching)           | -3 points  |
| Maintenance race (keeping sharp)     | 0 points   |

---

## SECTION F: DISTANCE & SURFACE OPTIMIZATION (±8 POINTS)

### Distance Change Analysis

**Favorable Distance Changes:**

| Scenario                          | Adjustment |
| --------------------------------- | ---------- |
| Sprint to route for proven router | +5 points  |
| Route to sprint for speed horse   | +6 points  |
| Moving to optimal distance        | +4 points  |
| Returning to successful distance  | +3 points  |

**Unfavorable Distance Changes:**

| Scenario                                 | Adjustment |
| ---------------------------------------- | ---------- |
| Sprint to route without stamina breeding | -5 points  |
| Route to sprint without early speed      | -3 points  |
| Moving away from optimal distance        | -4 points  |

**Distance Change with Class Relief:**

- Distance change + class drop: +3 additional points
- Distance change + class rise: -2 additional points

### Surface Change Evaluation

**Dirt to Turf Analysis:**

| Scenario                              | Adjustment |
| ------------------------------------- | ---------- |
| Strong turf breeding (sire 15%+ turf) | +6 points  |
| Previous turf success                 | +4 points  |
| No turf experience/breeding           | -6 points  |
| Poor previous turf attempts           | -8 points  |

**Turf to Dirt Analysis:**

| Scenario                         | Adjustment |
| -------------------------------- | ---------- |
| Returning to preferred surface   | +4 points  |
| Dirt breeding stronger than turf | +3 points  |
| Turf specialist forced to dirt   | -5 points  |

### Weather & Surface Condition Matching

**Wet Track Specialists:**

| Scenario                        | Base Adjustment |
| ------------------------------- | --------------- |
| Sire 20%+ wet track record      | +6 points       |
| Horse's wet track success       | +5 points       |
| Proven mudder in wet conditions | +8 points       |

**Poor Wet Track Performers:**

| Scenario                                 | Base Adjustment |
| ---------------------------------------- | --------------- |
| Poor wet track breeding                  | -4 points       |
| Historical wet track failures            | -6 points       |
| Surface specialist on changed conditions | -5 points       |

### Track Drainage Factor Integration

**NEW (v1.1):** Wet track bonuses/penalties are now amplified or reduced based on track-specific drainage characteristics from the Track Intelligence Database.

```
Adjusted Wet Score = Base Wet Score × Drainage Factor

Drainage Factors:
- Poor Drainage: 1.5× (wet conditions persist longer)
- Fair Drainage: 1.25×
- Good Drainage: 1.0× (standard)
- Excellent Drainage: 0.75× (track dries quickly, wet history less relevant)
```

| Track Drainage | Proven Mudder Bonus | Struggles in Mud Penalty |
| -------------- | ------------------- | ------------------------ |
| Poor           | +9 to +12 points    | -6 to -9 points          |
| Fair           | +7 to +10 points    | -5 to -8 points          |
| Good           | +5 to +8 points     | -4 to -6 points          |
| Excellent      | +4 to +6 points     | -3 to -5 points          |

**Example:** A proven mudder (+8 base) at a track with poor drainage (1.5× factor) receives +12 points instead of +8.

---

## SECTION G: HEAD-TO-HEAD & TACTICAL MATCHUPS (±8 POINTS)

### Direct Meeting Analysis

**Head-to-Head Record Evaluation:**

| Scenario                            | Adjustment                   |
| ----------------------------------- | ---------------------------- |
| Beat today's rival within 60 days   | +4 points per rival (max +8) |
| Lost to rival in similar conditions | -3 points per rival (max -6) |
| First meeting with key rival        | 0 points                     |

**Meeting Context Analysis:**

- Beat rival giving weight: +2 additional points
- Beat rival from worse post: +2 additional points
- Beat rival in stronger field: +2 additional points

### Pace Positioning Advantages

**Inside Speed Positioning:**

| Scenario                     | Adjustment |
| ---------------------------- | ---------- |
| Only inside speed horse      | +5 points  |
| Inside among speed horses    | +3 points  |
| Outside speed likely trapped | -2 points  |

**Stalking Position Optimization:**

| Scenario                              | Adjustment |
| ------------------------------------- | ---------- |
| Perfect stalking setup behind pace    | +4 points  |
| Stalking with clear acceleration path | +3 points  |
| Stalking position likely compromised  | -2 points  |

---

## SECTION H: MARKET INTELLIGENCE & VOLATILITY FACTORS

> **Note: Section H provides confidence modifiers only, not point adjustments to the overlay score.**

### Betting Pattern Analysis

**Overlay Detection:**

- Morning line vs. probable odds analysis
- Early money patterns
- Sharp money indicators
- Public vs. smart money splits

**Value Flags (Confidence Modifiers Only):**

| Flag           | Confidence Impact                      |
| -------------- | -------------------------------------- |
| Overlay Value+ | Horse deserves lower odds than offered |
| Underlay Risk- | Horse overbet relative to chances      |
| Neutral Market | Odds appropriately reflect chances     |

### Late Change Impacts

**Scratch Impact Assessment:**

- Key pace rival scratch: Recalculate entire pace scenario
- Field size reduction impact: Adjust exotic betting strategy
- Post position shifts: Recalculate post position scoring

**Equipment/Rider Changes:**

| Change Type               | Adjustment                             |
| ------------------------- | -------------------------------------- |
| Late jockey change impact | ±3 points based on replacement quality |
| Late equipment change     | ±2 points based on change type         |
| Late medication change    | ±2 points based on medication type     |

---

## OVERLAY INTEGRATION & FINAL CALCULATION

### Mathematical Combination Protocol

**Step 1: Calculate Individual Section Scores**

| Section                       | Range                    |
| ----------------------------- | ------------------------ |
| Section A (Pace/Bias)         | ±20 points               |
| Section B (Form/Conditioning) | ±15 points               |
| Section C (Trip/Trouble)      | ±12 points               |
| Section D (Class/Competition) | ±15 points               |
| Section E (Connections)       | ±10 points               |
| Section F (Distance/Surface)  | ±8 points                |
| Section G (Head-to-Head)      | ±8 points                |
| Section H (Market)            | Confidence modifier only |

**Step 2: Sum All Adjustment Sections**

```
Raw Overlay Score = A + B + C + D + E + F + G

Maximum Possible: +88 points
Minimum Possible: -88 points
```

**Step 3: Apply Overlay Cap**

```
If Raw Score > +50: Capped Score = +50, Overflow = Raw - 50
If Raw Score < -50: Capped Score = -50, Overflow = Raw + 50
If -50 ≤ Raw Score ≤ +50: Capped Score = Raw Score, Overflow = 0
```

**Step 4: Record Overflow as Confidence Modifier**

| Positive Overflow | Confidence Level   |
| ----------------- | ------------------ |
| 1-10 points       | High+ Confidence   |
| 11-20 points      | Maximum Confidence |
| 21+ points        | Supreme Confidence |

| Negative Overflow | Confidence Level |
| ----------------- | ---------------- |
| 1-10 points       | Caution          |
| 11-20 points      | Strong Caution   |
| 21+ points        | Extreme Caution  |

### Final Score Calculation

```
Final Score = Base Score (0-328) + Overlay Adjustment (±40)

Theoretical Range: 0 to 368 points
Practical Range: 50 to 320 points
Betting Threshold: 140+ points minimum
Elite Threshold: 200+ points
```

### Quality Control Verification

**Mandatory Overlay Checks:**

- Verify no double-counting between base score and overlay
- Confirm pace scenario logic consistency
- Validate trip note accuracy and impact
- Check class movement calculations
- Verify jockey/trainer change impacts
- Confirm all mathematical additions

**Reasonableness Tests:**

- Elite horses should show positive overlays
- Poor horses should show negative overlays
- Overlay should enhance, not contradict, base score logic
- Extreme overlays (±40+) require detailed justification

---

## OVERLAY APPLICATION EXAMPLES

### Example 1: Hot Pace Benefits Closer

**Scenario:**

- Horse is deep closer (C style)
- PPI = 32 (Hot Pace)
- Strong track closing bias this week
- Last race had wide trip excuse

**Overlay Calculation:**

- Section A: +20 (closer in hot pace) + 5 (closing bias) = +25 → Capped at +20
- Section C: +5 (wide trip excuse)
- **Total Overlay: +25 points**

### Example 2: Lone Speed Setup

**Scenario:**

- Horse is only early speed (E style)
- PPI = 8 (Dead Pace)
- Inside post position
- First start for new trainer after claim

**Overlay Calculation:**

- Section A: +20 (tactical speed in dead pace) + 5 (inside in soft pace) = +25 → Capped at +20
- Section E: +8 (first start off claim for elite barn)
- **Total Overlay: +28 points**

### Example 3: Negative Overlay Scenario

**Scenario:**

- Horse is pure speed (E style)
- PPI = 30 (Hot Pace)
- Speed duel likely with rival
- Jockey downgrade from leading rider

**Overlay Calculation:**

- Section A: -8 (speed in hot pace) + -5 (speed duel) = -13
- Section E: -5 (jockey downgrade)
- **Total Overlay: -18 points**

---

## INTEGRATION WITH EDGE CASE PROTOCOLS

### Diamond in the Rough Enhancement

For horses scoring 120-139 base points with extreme overlay:

- Apply standard overlay calculations
- Add Diamond special circumstance bonuses (see Edge Case Protocols)
- If Final Score ≥ 140: Qualifies for Tier 3 consideration

### Nuclear Longshot Detection

For horses at 25/1+ with specific angle:

- Calculate standard overlay
- Apply Nuclear scenario bonuses (see Edge Case Protocols)
- Assess extreme value opportunity

### Lightly Raced Compensation

For horses with <8 lifetime starts:

- Apply standard overlay calculations
- Add breeding enhancement bonuses (see Edge Case Protocols)
- Adjust confidence for limited data

---

_Document Version: 1.1_
_Last Updated: December 2025_
_Status: Complete Overlay System Specification_
_Integration: Applied after Base Score calculation, before Betting Tier assignment_
_Changes in v1.1: Added drainage factor for wet track scoring, stretch length factor for closer analysis, track condition real-time integration_
