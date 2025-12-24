# DRF FIELD MAP

## Complete Data Integration Protocol

> **This document maps every field in the DRF (Daily Racing Form) file format and defines how each data point integrates into the scoring system. No information is overlooked—every field serves a purpose in the mathematical analysis.**

---

## DRF FILE STRUCTURE OVERVIEW

### File Format Specifications

- **Format:** CSV (Comma-Separated Values)
- **Fields Per Line:** 1,435
- **One Line Per:** Horse entry
- **Encoding:** ASCII
- **File Extension:** .DRF

### Field Group Summary

| Field Range | Content Category                        |
| ----------- | --------------------------------------- |
| 1-27        | Race Header Information                 |
| 28-57       | Horse Identity & Connections            |
| 58-61       | Reserved/Unused                         |
| 62-101      | Lifetime Performance Records            |
| 102-113     | Past Performance Dates (up to 12)       |
| 114-125     | Past Performance Distances              |
| 126-137     | Past Performance Track Codes            |
| 138-149     | Past Performance Distances (feet)       |
| 150-161     | Past Performance Track Conditions       |
| 162-173     | Past Performance Equipment              |
| 174-185     | Past Performance Medication             |
| 186-209     | Past Performance Field Size & Positions |
| 210-225     | Running Style & Race Descriptions       |
| 226-255     | Wagering Information                    |
| 256-325     | Workout Data                            |
| 326-395     | Past Performance Surface & Conditions   |
| 396-435     | Trip Notes & Comments                   |
| 436-525     | Margins & Odds Data                     |
| 526-635     | Position Calls & Running Lines          |
| 636-765     | Lengths Behind/Ahead at Each Call       |
| 766-865     | Speed & Pace Figures                    |
| 866-945     | Fractional Times                        |
| 946-1055    | Extended Fractional Data                |
| 1056-1095   | Trainer/Jockey Names Per PP             |
| 1096-1145   | Running Style Codes & Race Types        |
| 1146-1221   | Trainer Statistics                      |
| 1222-1263   | Breeding & Sale Information             |
| 1264-1327   | Extended Statistics                     |
| 1328-1382   | Specialty Statistics & Categories       |
| 1383-1418   | Detailed Trip Notes                     |
| 1419-1435   | Race Classification Codes               |

---

## SECTION 1: RACE HEADER INFORMATION (Fields 1-27)

### Basic Race Identification

| Field | Content                      | Scoring Integration                                |
| ----- | ---------------------------- | -------------------------------------------------- |
| 1     | Track Code                   | Links to Track Intelligence Database for bias data |
| 2     | Race Date (YYYYMMDD)         | Calculates days since for layoff analysis          |
| 3     | Race Number                  | Race sequencing and multi-race analysis            |
| 4     | Post Position                | Category 2 scoring (Post Position & Bias)          |
| 5     | Reserved                     | —                                                  |
| 6     | Post Time (military)         | Time-of-day pattern analysis                       |
| 7     | Surface Code (D/T/S)         | Surface-specific scoring adjustments               |
| 8     | Reserved                     | —                                                  |
| 9     | Distance Code (S/R)          | Sprint vs Route classification                     |
| 10    | Race Type Code               | Class level determination                          |
| 11    | Race Name/Conditions         | Class and restriction analysis                     |
| 12    | Purse Amount                 | Class level indicator                              |
| 13-14 | Reserved                     | —                                                  |
| 15    | Distance (furlongs)          | Distance-specific scoring                          |
| 16    | Race Description (full text) | Condition parsing for restrictions                 |
| 17    | Top Picks/Favorites          | Morning line consensus                             |
| 18-20 | Reserved                     | —                                                  |
| 21    | Track Code (repeat)          | Verification                                       |
| 22    | Race Number (repeat)         | Verification                                       |
| 23    | Breed Code (TB/QH/AR)        | Breed-specific analysis                            |
| 24    | Field Size                   | Field strength calculations                        |
| 25-27 | Reserved                     | —                                                  |

### Scoring Application

**Track Code (Field 1):**

- Triggers Track Intelligence Database lookup
- Supplies post position bias values
- Provides track-specific par times
- Determines surface characteristics

**Surface Code (Field 7):**

- D = Dirt: Apply dirt bias patterns
- T = Turf: Apply turf bias patterns
- S = Synthetic: Apply synthetic patterns

**Distance Code (Field 9):**

- S = Sprint (under 1 mile): Sprint bias matrix
- R = Route (1 mile+): Route bias matrix

**Purse Amount (Field 12):**

- Class level indicator
- Comparison to horse's typical purse levels
- Class movement calculations

---

## SECTION 2: HORSE IDENTITY & CONNECTIONS (Fields 28-57)

### Trainer Information

| Field | Content                       | Scoring Integration            |
| ----- | ----------------------------- | ------------------------------ |
| 28    | Trainer Name                  | Category 1 (Elite Connections) |
| 29    | Trainer Starts (current meet) | Win rate calculation           |
| 30    | Trainer Wins (current meet)   | Win rate calculation           |
| 31    | Trainer Places (current meet) | ITM rate calculation           |
| 32    | Trainer Shows (current meet)  | ITM rate calculation           |

### Jockey Information

| Field | Content                      | Scoring Integration            |
| ----- | ---------------------------- | ------------------------------ |
| 33    | Jockey Name                  | Category 1 (Elite Connections) |
| 34    | Reserved                     | —                              |
| 35    | Jockey Starts (current meet) | Win rate calculation           |
| 36    | Jockey Wins (current meet)   | Win rate calculation           |
| 37    | Jockey Places (current meet) | ITM rate calculation           |
| 38    | Jockey Shows (current meet)  | ITM rate calculation           |

### Ownership & Silks

| Field | Content           | Scoring Integration        |
| ----- | ----------------- | -------------------------- |
| 39    | Owner Name        | Ownership pattern analysis |
| 40    | Silks Description | Visual identification      |
| 41-42 | Reserved          | —                          |

### Horse Identification

| Field | Content           | Scoring Integration          |
| ----- | ----------------- | ---------------------------- |
| 43    | Program Number    | Primary identification       |
| 44    | Morning Line Odds | Overlay calculation baseline |
| 45    | Horse Name        | Primary identification       |
| 46    | Age (years)       | Age-based adjustments        |
| 47    | Age (months)      | Precise age calculation      |
| 48    | Reserved          | —                            |
| 49    | Sex Code          | Sex-based restrictions       |
| 50    | Color             | Identification               |
| 51    | Weight (assigned) | Weight analysis              |

### Breeding Information

| Field | Content            | Scoring Integration                        |
| ----- | ------------------ | ------------------------------------------ |
| 52    | Sire Name          | Breeding analysis (Lightly Raced Protocol) |
| 53    | Sire's Sire        | Extended pedigree analysis                 |
| 54    | Dam Name           | Breeding analysis                          |
| 55    | Dam's Sire         | Damsire influence analysis                 |
| 56    | Breeder Name       | Breeding program patterns                  |
| 57    | State/Country Bred | State-bred restriction eligibility         |

### Scoring Application

**Trainer (Field 28):**

- Look up in Track Intelligence Database
- Retrieve trainer tier (Elite/Tier 2/Tier 3/Other)
- Apply situational modifiers
- Category 1: 0-35 points

**Jockey (Field 33):**

- Look up in Track Intelligence Database
- Retrieve jockey tier (Premium/Leading/Solid/Apprentice)
- Apply partnership bonuses with trainer
- Category 1: 0-15 points

**Morning Line (Field 44):**

- Baseline for overlay calculations
- Compare to calculated fair odds
- Overlay percentage determination

**Breeding (Fields 52-55):**

- Sire analysis for surface/distance preferences
- Dam production record
- Damsire stamina/speed influence
- Critical for Lightly Raced Protocol

---

## SECTION 3: LIFETIME PERFORMANCE RECORDS (Fields 62-101)

### Overall Lifetime Record

| Field | Content           | Scoring Integration   |
| ----- | ----------------- | --------------------- |
| 62    | Lifetime Starts   | Experience level      |
| 63    | Lifetime Wins     | Win consistency       |
| 64    | Lifetime Places   | ITM consistency       |
| 65    | Lifetime Shows    | ITM consistency       |
| 66-68 | Reserved          | —                     |
| 69    | Lifetime Earnings | Class level indicator |

### Current Year Record

| Field | Content               | Scoring Integration |
| ----- | --------------------- | ------------------- |
| 70    | Current Year Starts   | Recent activity     |
| 71    | Current Year Wins     | Current form        |
| 72    | Current Year Places   | Current form        |
| 73    | Current Year Shows    | Current form        |
| 74    | Current Year Earnings | Current class level |

### Previous Year Record

| Field | Content                | Scoring Integration   |
| ----- | ---------------------- | --------------------- |
| 75    | Previous Year Starts   | Historical comparison |
| 76    | Previous Year Wins     | Year-over-year trend  |
| 77    | Previous Year Places   | Year-over-year trend  |
| 78    | Previous Year Shows    | Year-over-year trend  |
| 79    | Previous Year Earnings | Class trajectory      |

### Track-Specific Record

| Field | Content        | Scoring Integration |
| ----- | -------------- | ------------------- |
| 80    | Track Starts   | Track experience    |
| 81    | Track Wins     | Track success rate  |
| 82    | Track Places   | Track ITM rate      |
| 83    | Track Shows    | Track ITM rate      |
| 84    | Track Earnings | Track class level   |

### Turf/Wet/Distance Records (P0 Critical)

These fields contain the horse's record on specific surfaces and at specific distances. This is fundamental "does this horse win at this distance/surface?" data.

| Field  | Content          | Scoring Integration                          |
| ------ | ---------------- | -------------------------------------------- |
| 85     | Turf Starts      | Surface preference analysis                  |
| 86     | Turf Wins        | Turf win rate calculation                    |
| 87     | Turf Places      | Turf ITM analysis                            |
| 88     | Turf Shows       | Turf ITM analysis                            |
| 89     | Wet Track Starts | Wet track competency                         |
| 90     | Wet Track Wins   | Wet track win rate                           |
| 91     | Wet Track Places | Wet track ITM analysis                       |
| 92     | Wet Track Shows  | Wet track ITM analysis                       |
| 93     | Distance Starts  | Distance preference at today's race distance |
| 94     | Distance Wins    | Distance win rate                            |
| 95     | Distance Places  | Distance ITM analysis                        |
| 96     | Distance Shows   | Distance ITM analysis                        |
| 97-101 | Lifetime Totals  | Summary verification                         |

### Scoring Application

**Lifetime Starts (Field 62):**

- Under 8 starts: Triggers Lightly Raced Protocol
- Experience adjustments for maiden analysis
- Pattern recognition baseline

**Track Record (Fields 80-84):**

- Multiple track wins: +5 points (Category 2)
- Track ITM rate assessment
- Course specialist identification

**Earnings (Fields 69, 74, 79, 84):**

- Class level baseline
- Class movement analysis
- Purse appropriateness assessment

---

## SECTION 4: PAST PERFORMANCE DATES (Fields 102-113)

### Race Date History

| Field | Content             | Scoring Integration                   |
| ----- | ------------------- | ------------------------------------- |
| 102   | PP1 Date (YYYYMMDD) | Most recent race - layoff calculation |
| 103   | PP2 Date            | Second most recent                    |
| 104   | PP3 Date            | Third most recent                     |
| 105   | PP4 Date            | Pattern analysis                      |
| 106   | PP5 Date            | Pattern analysis                      |
| 107   | PP6 Date            | Pattern analysis                      |
| 108   | PP7 Date            | Historical context                    |
| 109   | PP8 Date            | Historical context                    |
| 110   | PP9 Date            | Historical context                    |
| 111   | PP10 Date           | Extended history                      |
| 112   | PP11 Date           | Extended history                      |
| 113   | PP12 Date           | Extended history                      |

### Scoring Application

**Layoff Calculation:**

- Days since PP1 Date to today's race date
- 7-21 days: +8 points (Category 4)
- 22-35 days: +6 points
- 36-56 days: +4 points
- 57-90 days: +2 points
- 91-120 days: 0 points
- 120+ days: -3 points

**Racing Frequency Pattern:**

- Consistent spacing indicates maintained fitness
- Irregular spacing may indicate issues
- Trainer pattern matching

---

## SECTION 5: PAST PERFORMANCE TRACK & DISTANCE DATA (Fields 114-185)

### Distance Data (Fields 114-125, 138-149)

| Field Range | Content                 | Scoring Integration           |
| ----------- | ----------------------- | ----------------------------- |
| 114-125     | PP Distances (furlongs) | Distance preference analysis  |
| 138-149     | PP Distances (feet)     | Precise distance calculations |

### Track Codes (Fields 126-137)

| Field Range | Content        | Scoring Integration    |
| ----------- | -------------- | ---------------------- |
| 126-137     | PP Track Codes | Track class comparison |

### Track Conditions (Fields 150-161)

| Field Range | Content             | Scoring Integration       |
| ----------- | ------------------- | ------------------------- |
| 150-161     | PP Track Conditions | Wet track record analysis |

**Condition Codes:**

- ft = Fast
- gd = Good
- my = Muddy
- sy = Sloppy
- fm = Firm (turf)
- yl = Yielding (turf)
- sf = Soft (turf)

### Equipment (Fields 162-173)

| Field Range | Content            | Scoring Integration        |
| ----------- | ------------------ | -------------------------- |
| 162-173     | PP Equipment Codes | Equipment change detection |

**Equipment Code Parsing:**

- B = Blinkers
- L = Lasix
- f = Front bandages
- r = Rear bandages
- s = Steel shoes
- a = Aluminum pads
- t = Tongue tie

### Medication (Fields 174-185)

| Field Range | Content             | Scoring Integration         |
| ----------- | ------------------- | --------------------------- |
| 174-185     | PP Medication Codes | Medication pattern analysis |

### Scoring Application

**Distance Analysis:**

- Compare today's distance to successful PP distances
- Identify distance preferences
- Stretch-out/cutback pattern recognition

**Track Condition Record:**

- Count wet track performances
- Calculate wet track win rate
- Apply wet weather breeding analysis

**Equipment Changes:**

- Compare current equipment to PP equipment
- First-time equipment detection
- Equipment removal detection
- Category 5 scoring trigger

---

## SECTION 6: FIELD SIZE & POSITION DATA (Fields 186-209)

### Field Size Per PP

| Field Range | Content        | Scoring Integration    |
| ----------- | -------------- | ---------------------- |
| 186-197     | PP Field Sizes | Field strength context |

### Post Position Per PP

| Field Range | Content           | Scoring Integration       |
| ----------- | ----------------- | ------------------------- |
| 198-209     | PP Post Positions | Post position performance |

### Scoring Application

**Field Size Context:**

- Small field wins (5 or fewer): Discounted slightly
- Large field wins (10+): Enhanced value
- Competitive field assessment

**Post Position History:**

- Success from inside posts vs outside
- Post position preference identification
- Today's post position advantage assessment

---

## SECTION 7: RUNNING STYLE & RACE DESCRIPTIONS (Fields 210-225)

### Running Style Classification

| Field | Content            | Scoring Integration          |
| ----- | ------------------ | ---------------------------- |
| 210   | Running Style Code | Category 6 (Pace & Tactical) |

**Running Style Codes:**

- E = Early speed (front-runner)
- E/P = Early presser
- P = Presser
- S = Stalker
- C = Closer

### Race Description Data

| Field Range | Content              | Scoring Integration |
| ----------- | -------------------- | ------------------- |
| 211-223     | Speed Points/Ratings | Pace analysis       |
| 224         | Best Speed Figure    | Class assessment    |
| 225         | Race Conditions Text | Full race parsing   |

### Scoring Application

**Running Style (Field 210):**

- Critical for pace scenario analysis
- Determines bias alignment
- Category 6 scoring foundation

**Speed Points (Field 211):**

- Quirin-style speed points
- Pace pressure index calculation
- Early speed quantification

---

## SECTION 8: WAGERING & ODDS INFORMATION (Fields 226-255)

### Wagering Details

| Field Range | Content                | Scoring Integration   |
| ----------- | ---------------------- | --------------------- |
| 226-240     | Wagering Pool Types    | Exotic availability   |
| 241-250     | Multi-Race Wager Info  | Pick 3/4/5/6 analysis |
| 251         | Today's Program Number | Verification          |
| 252-255     | Reserved               | —                     |

---

## SECTION 9: WORKOUT DATA (Fields 256-325)

### Workout Dates

| Field Range | Content                  | Scoring Integration      |
| ----------- | ------------------------ | ------------------------ |
| 256-265     | Workout Dates (10 works) | Workout pattern analysis |

### Workout Days Since

| Field Range | Content              | Scoring Integration |
| ----------- | -------------------- | ------------------- |
| 266-275     | Days Since Each Work | Workout timing      |

### Workout Tracks

| Field Range | Content             | Scoring Integration |
| ----------- | ------------------- | ------------------- |
| 276-295     | Workout Track Codes | Training location   |

### Workout Posts/Rankings

| Field Range | Content                 | Scoring Integration   |
| ----------- | ----------------------- | --------------------- |
| 296-305     | Workout Post Position   | Gate work detection   |
| 306-315     | Workout Track Condition | Work surface          |
| 316-325     | Workout Distance        | Work distance pattern |

### Scoring Application

**Workout Pattern Analysis:**

- Bullet works (rank 1): +8 points if within 14 days
- Multiple bullets in 30 days: +10 points
- Gate work within 10 days: +8 points (first-timers)
- Consistent work pattern: +5 points
- Work regression pattern: -5 points

**Workout Timing:**

- Days between works
- Work-to-race timing
- Trainer work pattern matching

---

## SECTION 10: PAST PERFORMANCE SURFACE DATA (Fields 326-395)

### Surface Types Per PP

| Field Range | Content          | Scoring Integration |
| ----------- | ---------------- | ------------------- |
| 326-335     | PP Surface Codes | Surface preference  |

### Inner/Outer Track

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 336-345     | Inner/Outer Track | Track configuration |

### Field Size Context

| Field Range | Content                 | Scoring Integration |
| ----------- | ----------------------- | ------------------- |
| 346-355     | PP Field Sizes (repeat) | Verification        |

### Finish Position

| Field Range | Content             | Scoring Integration |
| ----------- | ------------------- | ------------------- |
| 356-365     | PP Finish Positions | Form analysis       |

### Lengths Behind at Finish

| Field Range | Content           | Scoring Integration     |
| ----------- | ----------------- | ----------------------- |
| 366-375     | PP Finish Margins | Beaten lengths analysis |

### Reserved/Extended

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 376-395     | Reserved/Extended | —                   |

### Scoring Application

**Surface Preference:**

- Dirt record vs Turf record
- Surface switch success rate
- Surface-specific breeding factors

**Finish Position Trend:**

- Improving positions: +8 points (3 straight)
- Declining positions: -5 points (3 straight)
- Form cycle identification

---

## SECTION 11: TRIP NOTES & COMMENTS (Fields 396-435)

### Abbreviated Trip Notes

| Field Range | Content             | Scoring Integration      |
| ----------- | ------------------- | ------------------------ |
| 396-405     | Short Trip Comments | Quick trouble assessment |

### Winner Names

| Field Range | Content         | Scoring Integration |
| ----------- | --------------- | ------------------- |
| 406-415     | PP Race Winners | Key race analysis   |

### Second Place Names

| Field Range | Content         | Scoring Integration |
| ----------- | --------------- | ------------------- |
| 416-425     | PP Second Place | Key race analysis   |

### Third Place Names

| Field Range | Content        | Scoring Integration |
| ----------- | -------------- | ------------------- |
| 426-435     | PP Third Place | Key race analysis   |

### Scoring Application

**Trip Note Analysis (Overlay System):**

Major Trouble Categories:

- "Checked," "blocked," "steadied": +6 to +10 points
- "Wide trip," "5-wide": +4 to +6 points
- "Stumbled," "bumped": +4 to +8 points
- "No room," "shut off": +6 to +8 points

**Key Race Analysis:**

- Track next-out winners from horse's races
- Key Race Index (KRI) calculation
- Strong form race identification

---

## SECTION 12: MARGINS & ODDS DATA (Fields 436-525)

### Weight Carried Per PP

| Field Range | Content            | Scoring Integration     |
| ----------- | ------------------ | ----------------------- |
| 436-445     | PP Weights Carried | Weight pattern analysis |

### Weight - Winner/Second/Third

| Field Range | Content       | Scoring Integration |
| ----------- | ------------- | ------------------- |
| 446-465     | Top 3 Weights | Weight comparison   |

### Margins at Calls

| Field Range | Content                  | Scoring Integration       |
| ----------- | ------------------------ | ------------------------- |
| 466-495     | Margins at Various Calls | Running position analysis |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 496-505     | Reserved | —                   |

### Winner Weight

| Field Range | Content        | Scoring Integration |
| ----------- | -------------- | ------------------- |
| 506-515     | Winner Weights | Weight differential |

### Final Odds Per PP

| Field Range | Content       | Scoring Integration      |
| ----------- | ------------- | ------------------------ |
| 516-525     | PP Final Odds | Historical odds patterns |

### Scoring Application

**Weight Analysis:**

- Weight carried vs performance correlation
- Optimal weight range identification
- Weight change impact assessment

**Odds Patterns:**

- Public perception trends
- Beaten favorite analysis
- Overlay opportunity history

---

## SECTION 13: RACE CLASSIFICATION DATA (Fields 526-565)

### Race Type Codes Per PP

| Field Range | Content            | Scoring Integration  |
| ----------- | ------------------ | -------------------- |
| 536-545     | PP Race Type Codes | Class level per race |

### Claiming Prices

| Field Range | Content            | Scoring Integration     |
| ----------- | ------------------ | ----------------------- |
| 546-555     | PP Claiming Prices | Class movement tracking |

### Purse Values

| Field Range | Content          | Scoring Integration      |
| ----------- | ---------------- | ------------------------ |
| 556-565     | PP Purse Amounts | Class level verification |

### Scoring Application

**Class Movement Analysis:**

- Track claiming price progression
- Identify class drops/rises
- Calculate class relief percentage
- Category 3 class scoring

**Race Type Progression:**

- MSW to MCL drops: +8 points with figure support
- Allowance to claiming: +8 points with excuse
- Stakes class assessment

---

## SECTION 14: POSITION CALLS (Fields 566-635)

### Start Position

| Field Range | Content            | Scoring Integration |
| ----------- | ------------------ | ------------------- |
| 566-575     | PP Start Positions | Gate break analysis |

### First Call Position

| Field Range | Content                 | Scoring Integration      |
| ----------- | ----------------------- | ------------------------ |
| 576-585     | PP First Call Positions | Early speed verification |

### Second Call Position

| Field Range | Content                  | Scoring Integration |
| ----------- | ------------------------ | ------------------- |
| 586-595     | PP Second Call Positions | Pace positioning    |

### Third Call Position

| Field Range | Content                 | Scoring Integration  |
| ----------- | ----------------------- | -------------------- |
| 596-605     | PP Third Call Positions | Mid-race positioning |

### Stretch Call Position

| Field Range | Content              | Scoring Integration   |
| ----------- | -------------------- | --------------------- |
| 606-615     | PP Stretch Positions | Stretch move analysis |

### Finish Position

| Field Range | Content             | Scoring Integration     |
| ----------- | ------------------- | ----------------------- |
| 616-625     | PP Finish Positions | Final position (repeat) |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 626-635     | Reserved | —                   |

### Scoring Application

**Running Line Analysis:**

- Verify running style classification
- Identify tactical patterns
- Detect position improvement/regression
- Pace figure correlation

**Gate Break Assessment:**

- Consistent starts: +1 point
- Poor starts: -2 points (if pattern)
- Gate work consideration for issues

---

## SECTION 15: LENGTHS BEHIND/AHEAD DATA (Fields 636-765)

### Lengths at First Call

| Field Range | Content                | Scoring Integration   |
| ----------- | ---------------------- | --------------------- |
| 636-655     | PP Lengths at 1st Call | Early pace assessment |

### Lengths at Second Call

| Field Range | Content                | Scoring Integration    |
| ----------- | ---------------------- | ---------------------- |
| 656-675     | PP Lengths at 2nd Call | Pace pressure analysis |

### Lengths at Third Call

| Field Range | Content                | Scoring Integration  |
| ----------- | ---------------------- | -------------------- |
| 676-695     | PP Lengths at 3rd Call | Positioning analysis |

### Lengths at Stretch

| Field Range | Content               | Scoring Integration |
| ----------- | --------------------- | ------------------- |
| 696-715     | PP Lengths at Stretch | Stretch position    |

### Reserved

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 716-755     | Reserved/Extended | —                   |

### Lengths at Finish

| Field Range | Content                | Scoring Integration      |
| ----------- | ---------------------- | ------------------------ |
| 756-765     | Finish Margin Variants | Final margin calculation |

### Scoring Application

**Pace Pressure Index:**

- Lengths behind at half-mile call
- Early speed confirmation
- Pace scenario modeling

**Closing Ability:**

- Lengths gained in stretch
- Late kick quantification
- Closer effectiveness rating

---

## SECTION 16: SPEED & PACE FIGURES (Fields 766-865)

### Speed Figures Per PP

| Field Range | Content                    | Scoring Integration      |
| ----------- | -------------------------- | ------------------------ |
| 766-775     | PP Beyer/DRF Speed Figures | Category 3 (Speed/Class) |

### Variant Speed Figures

| Field Range | Content            | Scoring Integration     |
| ----------- | ------------------ | ----------------------- |
| 776-785     | PP Variant Figures | Adjusted speed analysis |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 786-815     | Reserved | —                   |

### Early Pace Figures (EP1)

| Field Range | Content               | Scoring Integration    |
| ----------- | --------------------- | ---------------------- |
| 816-825     | PP Early Pace Figures | Pace scenario analysis |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 826-845     | Reserved | —                   |

### Late Pace Figures

| Field Range | Content              | Scoring Integration |
| ----------- | -------------------- | ------------------- |
| 846-855     | PP Late Pace Figures | Closing ability     |

### Average Pace Figures

| Field Range | Content         | Scoring Integration |
| ----------- | --------------- | ------------------- |
| 856-865     | PP Average Pace | Overall pace rating |

### Scoring Application

**Speed Figures (Fields 766-775):**

- Primary Category 3 scoring input
- 85+: +20 points
- 80-84: +15 points
- 75-79: +10 points
- 70-74: +5 points
- Under 70: 0 points

**Early Pace Figures (Fields 816-825):**

- EP1 under 75: Confirmed early speed
- Pace Pressure Index calculation
- Running style verification

**Late Pace Figures (Fields 846-855):**

- Closing kick measurement
- Sustained speed ability
- Late pace figure trends

---

## SECTION 17: FRACTIONAL TIMES (Fields 866-945)

### Quarter Times

| Field Range | Content          | Scoring Integration |
| ----------- | ---------------- | ------------------- |
| 866-875     | PP Quarter Times | Pace analysis       |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 876-885     | Reserved | —                   |

### Half-Mile Times

| Field Range | Content            | Scoring Integration         |
| ----------- | ------------------ | --------------------------- |
| 896-905     | PP Half-Mile Times | Pace scenario determination |

### Six Furlong Times

| Field Range | Content     | Scoring Integration |
| ----------- | ----------- | ------------------- |
| 906-915     | PP 6F Times | Sprint final time   |

### Mile Times

| Field Range | Content       | Scoring Integration |
| ----------- | ------------- | ------------------- |
| 916-925     | PP Mile Times | Route pace analysis |

### Extended Times

| Field Range | Content                  | Scoring Integration |
| ----------- | ------------------------ | ------------------- |
| 926-945     | Extended Fractional Data | Route analysis      |

### Scoring Application

**Pace Scenario Determination:**

Using half-mile times:

- Under :45.0 = Hot pace contributor
- :45.0-:46.0 = Honest pace
- Over :46.0 = Slow pace

**Pace Pressure Index (PPI) Calculation:**

```
PPI = Sum of Quirin Pace Points for top 4 speed horses
- Hot Pace: PPI ≥ 28 (4+ speed horses)
- Moderate-Hot: PPI 22-27 (3 speed horses)
- Honest Pace: PPI 16-21 (2 speed horses)
- Soft Pace: PPI 10-15 (1 speed horse)
- Dead Pace: PPI ≤ 9 (no early speed)
```

---

## SECTION 18: EXTENDED FRACTIONAL DATA (Fields 946-1055)

### Repeated Fractional Times

| Field Range | Content                     | Scoring Integration |
| ----------- | --------------------------- | ------------------- |
| 986-1015    | Quarter/Half Times (repeat) | Verification        |

### Final Times

| Field Range | Content          | Scoring Integration |
| ----------- | ---------------- | ------------------- |
| 1006-1015   | Final Race Times | Time-based analysis |

### Extended Route Times

| Field Range | Content               | Scoring Integration |
| ----------- | --------------------- | ------------------- |
| 1016-1035   | Route Fractional Data | Route pace parsing  |

### Final Time Variants

| Field Range | Content                 | Scoring Integration |
| ----------- | ----------------------- | ------------------- |
| 1036-1055   | Final Time Calculations | Time comparison     |

### Scoring Application

**Final Time Analysis:**

- Compare to track par times
- Identify speed figure outliers
- Time-based class assessment

---

## SECTION 19: TRAINER/JOCKEY PER PP (Fields 1056-1095)

### Trainer Names Per PP

| Field Range | Content          | Scoring Integration       |
| ----------- | ---------------- | ------------------------- |
| 1056-1065   | PP Trainer Names | Trainer changes detection |

### Jockey Names Per PP

| Field Range | Content         | Scoring Integration      |
| ----------- | --------------- | ------------------------ |
| 1066-1075   | PP Jockey Names | Jockey changes detection |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 1076-1085   | Reserved | —                   |

### Running Style Per PP

| Field Range | Content                | Scoring Integration |
| ----------- | ---------------------- | ------------------- |
| 1086-1095   | PP Running Style Codes | Style consistency   |

### Scoring Application

**Connection Changes:**

- New trainer detection: Triggers trainer switch analysis
- New jockey detection: Jockey upgrade/downgrade assessment
- Overlay System: Connection edge calculations

**Running Style Verification:**

- Cross-reference with calculated style
- Style consistency assessment
- Style changes indicating equipment/conditioning

---

## SECTION 20: RACE TYPE CODES PER PP (Fields 1096-1145)

### Race Type/Class Codes

| Field Range | Content            | Scoring Integration  |
| ----------- | ------------------ | -------------------- |
| 1096-1105   | PP Race Type Codes | Class level tracking |

### Reserved/Extended

| Field Range | Content                 | Scoring Integration |
| ----------- | ----------------------- | ------------------- |
| 1106-1145   | Extended Classification | —                   |

### Scoring Application

**Race Type Codes:**

- MSW = Maiden Special Weight
- MCL = Maiden Claiming
- CLM = Claiming
- ALW = Allowance
- AOC = Allowance Optional Claiming
- STK = Stakes

**Class Progression Analysis:**

- Track class movement over time
- Identify class ceiling
- Calculate drop percentage for Category 3

---

## SECTION 21: TRAINER CATEGORY STATISTICS (Fields 1146-1221)

This section contains 19 trainer specialty categories, each with 4 fields:

- Starts: Number of starts in this category
- Wins: Number of wins in this category
- Win%: Win percentage (0-100)
- ROI: Return on investment (percentage, typically -100 to +500)

### Complete Trainer Category Field Mapping

| Fields    | Category                | Description                                     |
| --------- | ----------------------- | ----------------------------------------------- |
| 1146-1149 | First Time Lasix        | Trainer stats with horse on Lasix first time    |
| 1150-1153 | 2nd Off Layoff          | Trainer stats in horse's 2nd start after layoff |
| 1154-1157 | 31-60 Days Off          | Trainer stats after 31-60 day layoff            |
| 1158-1161 | Turf Sprint             | Trainer stats in turf sprints                   |
| 1162-1165 | Turf Route              | Trainer stats in turf routes                    |
| 1166-1169 | First Time Blinkers     | Trainer stats with horse on blinkers first time |
| 1170-1173 | Blinkers Off            | Trainer stats with blinkers removed             |
| 1174-1177 | Sprint to Route         | Trainer stats stretching out to route           |
| 1178-1181 | Route to Sprint         | Trainer stats cutting back to sprint            |
| 1182-1185 | Maiden Claiming         | Trainer stats in maiden claiming races          |
| 1186-1189 | First Start for Trainer | Trainer stats with horses new to barn           |
| 1190-1193 | After Claim             | Trainer stats immediately after claiming        |
| 1194-1197 | 61-90 Days Off          | Trainer stats after 61-90 day layoff            |
| 1198-1201 | 91-180 Days Off         | Trainer stats after 91-180 day layoff           |
| 1202-1205 | 181+ Days Off           | Trainer stats after 181+ day layoff             |
| 1206-1209 | Dirt Sprints            | Trainer stats in dirt sprints                   |
| 1210-1213 | Dirt Routes             | Trainer stats in dirt routes                    |
| 1214-1217 | Wet Tracks              | Trainer stats on wet/off tracks                 |
| 1218-1221 | Stakes Races            | Trainer stats in stakes races                   |

### Field Structure Per Category

Each 4-field group follows this structure:

| Offset | Content | Type    | Example |
| ------ | ------- | ------- | ------- |
| +0     | Starts  | Integer | 45      |
| +1     | Wins    | Integer | 9       |
| +2     | Win %   | Float   | 20.0    |
| +3     | ROI     | Float   | 125.5   |

### Scoring Application

**High-Value Situational Patterns:**

These trainer specialty statistics are critical for identifying situational edges:

- **First Time Lasix** (Fields 1146-1149): Trainers with high win% on first-time Lasix are valuable angles
- **2nd Off Layoff** (Fields 1150-1153): Second-start-off-layoff specialists
- **First Time Blinkers** (Fields 1166-1169): Equipment change specialists
- **Sprint to Route / Route to Sprint** (Fields 1174-1181): Distance change patterns
- **First Start for Trainer** (Fields 1186-1189): Claim/transfer specialists
- **After Claim** (Fields 1190-1193): Immediate post-claim improvement

**Layoff Specialists:**

- 31-60 Days Off (Fields 1154-1157)
- 61-90 Days Off (Fields 1194-1197)
- 91-180 Days Off (Fields 1198-1201)
- 181+ Days Off (Fields 1202-1205)

**Surface/Distance Specialists:**

- Turf Sprint (Fields 1158-1161)
- Turf Route (Fields 1162-1165)
- Dirt Sprints (Fields 1206-1209)
- Dirt Routes (Fields 1210-1213)
- Wet Tracks (Fields 1214-1217)

**These patterns directly apply to Category 1 situational modifiers.**

---

## SECTION 22: BREEDING & SALE DATA (Fields 1222-1263)

### Sale Information

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 1222-1223   | Sale/Auction Data | Investment level    |

### Breed Type Per PP

| Field Range | Content        | Scoring Integration |
| ----------- | -------------- | ------------------- |
| 1224-1233   | PP Breed Codes | Breed verification  |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 1234-1256   | Reserved | —                   |

### Extended Breeding

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 1257-1263   | Extended Pedigree | Breeding analysis   |

### Scoring Application

**Lightly Raced Protocol Trigger:**

- Sale price indicates investment level
- High auction price + poor results = excuses likely
- Breeding quality assessment

---

## SECTION 23: EXTENDED STATISTICS (Fields 1264-1327)

### Timeform/Extended Figures

| Field Range | Content             | Scoring Integration |
| ----------- | ------------------- | ------------------- |
| 1264-1273   | Extended Speed Data | Alternative figures |

### Reserved

| Field Range | Content           | Scoring Integration |
| ----------- | ----------------- | ------------------- |
| 1274-1327   | Reserved/Extended | —                   |

---

## SECTION 24: SPECIALTY STATISTICS (Fields 1328-1382)

### Surface/Distance Stats

| Field Range | Content              | Scoring Integration     |
| ----------- | -------------------- | ----------------------- |
| 1328-1336   | Specific Record Data | Surface/distance record |

### Trainer Angle Statistics

| Field Range | Content                | Scoring Integration  |
| ----------- | ---------------------- | -------------------- |
| 1337-1356   | Trainer Category Stats | Angle identification |

Format: Category Name, Starts, Win%, ITM%, ROI

### Jockey Statistics

| Field Range | Content               | Scoring Integration |
| ----------- | --------------------- | ------------------- |
| 1367-1373   | Jockey Category Stats | Jockey angles       |

### Post Time Data

| Field Range | Content          | Scoring Integration |
| ----------- | ---------------- | ------------------- |
| 1374        | Post Time String | Verification        |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 1375-1382   | Reserved | —                   |

### Scoring Application

**Trainer Angle Categories (Fields 1337-1356):**

- "3rd off layoff": Layoff pattern success
- "Maiden Sp Wt": Maiden success rate
- "Sprints": Distance preference success
- "Dirt starts": Surface preference success

**These statistics directly inform Category 1 situational modifiers.**

---

## SECTION 25: DETAILED TRIP NOTES (Fields 1383-1418)

### Extended Trip Comments

| Field Range | Content                      | Scoring Integration            |
| ----------- | ---------------------------- | ------------------------------ |
| 1383-1392   | Detailed Trip Notes (10 PPs) | Overlay System (Trip Analysis) |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 1393-1412   | Reserved | —                   |

### Lifetime Stats Summary

| Field Range | Content          | Scoring Integration |
| ----------- | ---------------- | ------------------- |
| 1413-1417   | Lifetime Summary | Verification        |

### Post Time Code

| Field Range | Content        | Scoring Integration |
| ----------- | -------------- | ------------------- |
| 1418        | Post Time Code | Race timing         |

### Scoring Application

**Detailed Trip Note Analysis (Overlay System ±12 points):**

**Major Trouble (+8 to +10 points):**

- "Checked hard," "pulled up sharply"
- "Blocked," "no room," "shut off"
- "Steadied repeatedly," "bumped hard"
- "Clipped heels," "stumbled badly"

**Wide Trip (+4 to +6 points):**

- "5-wide turn," "6-wide throughout"
- "4-wide turn," "wide trip"
- "Carried wide," "forced wide"

**Pace Issues (+3 to +5 points):**

- "Hustled early," "pressured throughout"
- "Dueled to half," "contested pace"
- "Rushed up," "used early"

**Equipment/Start Issues (+3 to +4 points):**

- "Reared at start," "dwelt at break"
- "Lugged in/out," "bearing in/out"

---

## SECTION 26: RACE CLASSIFICATION CODES (Fields 1419-1435)

### Today's Race Code

| Field Range | Content                   | Scoring Integration |
| ----------- | ------------------------- | ------------------- |
| 1419-1428   | Race Classification Codes | Class verification  |

### Final Race Type

| Field Range | Content              | Scoring Integration |
| ----------- | -------------------- | ------------------- |
| 1429        | Final Race Type Code | Race type           |

### Reserved

| Field Range | Content  | Scoring Integration |
| ----------- | -------- | ------------------- |
| 1430-1434   | Reserved | —                   |

### End of Line

| Field | Content         | Scoring Integration |
| ----- | --------------- | ------------------- |
| 1435  | Line Terminator | End of record       |

---

## DATA QUALITY CONTROL

### Mandatory Field Validation

**Critical Fields (Must Be Present):**

- Field 1: Track Code
- Field 2: Race Date
- Field 4: Post Position
- Field 28: Trainer Name
- Field 33: Jockey Name
- Field 45: Horse Name
- Field 102: Last Race Date
- Fields 766-775: Speed Figures

**Cross-Reference Validation:**

- Verify trainer stats match trainer name
- Confirm jockey stats match jockey name
- Validate equipment codes consistency
- Check speed figure reasonableness

### Missing Data Handling

**If Speed Figures Missing:**

- Use pace figures as proxy
- Apply reduced confidence modifier
- Flag for manual review

**If Trip Notes Missing:**

- Cannot apply trip-based overlay adjustments
- Note in analysis output
- Rely on positional data for trip inference

**If Equipment Data Missing:**

- Assume no equipment changes
- Apply conservative equipment scoring
- Flag potential data gap

---

## INTEGRATION SUMMARY

### Category Mapping

| Category          | Primary DRF Fields                     |
| ----------------- | -------------------------------------- |
| 1. Connections    | 28-38, 1056-1075, 1147-1176, 1337-1373 |
| 2. Post/Bias      | 4, 1, 198-209, 150-161                 |
| 3. Speed/Class    | 766-775, 536-565, 556-565              |
| 4. Form/Condition | 102-113, 356-365, 256-325              |
| 5. Equipment      | 162-173, 174-185, 1192-1201            |
| 6. Pace/Tactical  | 210, 816-825, 846-865, 896-905         |

### Overlay System Mapping

| Overlay Section  | Primary DRF Fields        |
| ---------------- | ------------------------- |
| Pace Dynamics    | 816-825, 896-905, 210     |
| Form Cycle       | 766-775, 102-113, 256-325 |
| Trip Analysis    | 396-405, 1383-1392        |
| Class Movement   | 536-565, 556-565          |
| Connection Edges | 1056-1075, 28, 33         |
| Distance/Surface | 114-125, 326-335, 150-161 |
| Head-to-Head     | 406-435                   |

---

_Document Version: 1.0_
_Status: Complete DRF Field Mapping_
_Total Fields Mapped: 1,435_
_Integration: Direct feed to Scoring Engine and Overlay System_
