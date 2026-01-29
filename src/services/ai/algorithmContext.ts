/**
 * Algorithm Context for AI Prompts
 *
 * Contains the essential algorithm reference information that AI models need
 * to understand the scoring system. Derived from ALGORITHM_REFERENCE.md.
 *
 * Algorithm Version: v4.0 (336 base score, expanded combo patterns)
 * Source: ALGORITHM_REFERENCE.md
 */

/**
 * Concise algorithm reference for AI prompts.
 * Kept under 800 tokens to leave room for race data.
 */
export const ALGORITHM_CONTEXT = `## ALGORITHM v4.0 REFERENCE

### Scoring Structure
- Base Score: 0-336 pts (14 categories)
- Overlay Adjustment: ±40 pts (capped)
- Final Score: 0-376 pts (floor at 0)

### Base Score Categories (336 pts total)
| Category | Points | Weight |
|----------|--------|--------|
| Speed & Class | 140 | 41.7% |
| Form | 50 | 14.9% |
| Pace | 45 | 13.4% |
| Connections | 24 | 7.1% |
| Distance/Surface | 20 | 6.0% |
| Post Position | 12 | 3.6% |
| Track Specialist | 10 | 3.0% |
| Combo Patterns | 10 | 3.0% |
| Trainer Patterns | 8 | 2.4% |
| Equipment | 8 | 2.4% |
| Trainer Surface/Dist | 6 | 1.8% |
| P3 Refinements | 2 | 0.6% |
| Weight | 1 | 0.3% |

### Overlay Adjustments (±40 max total)
| Section | Max |
|---------|-----|
| A: Pace Dynamics & Bias | ±10 |
| B: Form Cycle & Conditioning | ±15 |
| C: Trip Analysis & Trouble | ±10 |
| D: Class Movement | ±12 |
| E: Connection Micro-Edges | ±8 |
| F: Distance & Surface Opt. | ±6 |
| G: Head-to-Head & Tactical | ±6 |

### Betting Tiers (per ALGORITHM_REFERENCE.md)
| Tier | Score | Action |
|------|-------|--------|
| Tier 1 (Chalk) | 181+ | Primary bets |
| Tier 2 (Alternatives) | 161-180 | Secondary bets |
| Tier 3 (Value) | 131-160 | Small stabs |
| Diamond Check | 122-130 | Review if 200%+ overlay |
| Pass | <122 | No bet |

### Confidence Levels
| Level | Data % | Effect |
|-------|--------|--------|
| HIGH | 80-100% | Full confidence |
| MEDIUM | 60-79% | Minor uncertainty |
| LOW | <60% | 15% base score penalty |

### Edge Cases
- Diamond in the Rough: 122-130 pts + 200%+ overlay = special review
- Lightly Raced: <8 starts triggers breeding compensation
- Nuclear Longshot: 25/1+ with specific angle = separate evaluation
- Late Changes: Scratches/equipment/jockey = full recalculation`;

/**
 * Compact version for specialist bots that need less context.
 * Focused on tier thresholds and confidence.
 */
export const ALGORITHM_CONTEXT_COMPACT = `## ALGORITHM v4.0 QUICK REF
- Base Score: 0-336 pts | Overlay: ±40 | Final: 0-376
- Tier 1: 181+ | Tier 2: 161-180 | Tier 3: 131-160 | Diamond: 122-130 | Pass: <122
- Confidence: HIGH (80%+), MEDIUM (60-79%), LOW (<60% = 15% penalty)`;

/**
 * Pace-specific context for pace scenario bot.
 */
export const PACE_CONTEXT = `## PACE SCORING CONTEXT
- Pace category: 45 pts (13.7% of base score)
- Overlay Section A (Pace Dynamics & Bias): ±10 pts max
- Speed duel = hot pace = closers benefit
- Lone speed = slow pace = front-runners benefit`;

/**
 * Trip trouble context for trip analysis bot.
 */
export const TRIP_TROUBLE_CONTEXT = `## TRIP ANALYSIS CONTEXT
- Overlay Section C (Trip Analysis & Trouble): ±10 pts max
- Trip trouble can mask true ability by 5-15 points
- Look for: blocked, checked, steadied, wide trip, bumped`;

/**
 * Field spread context for field analysis bot.
 */
export const FIELD_SPREAD_CONTEXT = `## FIELD SPREAD CONTEXT
- Tier 1: 181+ (primary bets) | Tier 2: 161-180 | Tier 3: 131-160
- SEPARATED: 15+ pt gap between top horses = go narrow
- TIGHT: Top 4 within 10 pts = go wide
- Confidence: HIGH/MEDIUM/LOW affects bet sizing`;

/**
 * Vulnerable favorite context.
 */
export const VULNERABLE_FAVORITE_CONTEXT = `## VULNERABLE FAVORITE CONTEXT
- Tier 1 threshold: 181+ points
- Score gap <15 pts to #2 = vulnerable indicator
- Confidence: HIGH (80%+), MEDIUM (60-79%), LOW (<60%)
- LOW confidence applies 15% base score penalty`;
