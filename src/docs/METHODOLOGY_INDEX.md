# FURLONG METHODOLOGY INDEX

## Master Documentation Reference

> **This index provides navigation to all methodology documentation. Each document is self-contained but designed to work together as a complete handicapping system.**

---

## DOCUMENTATION MAP

```
src/docs/
├── METHODOLOGY_INDEX.md      ← You are here
├── ALGORITHM_V3_SUMMARY.md   ← Current v3.6 algorithm (336-pt base, form decay)
├── SCORING_ENGINE.md         ← Detailed scoring reference (v2.0 legacy + v3.6 notes)
├── DRF_FIELD_MAP.md          ← All 1,435 DRF fields mapped
├── OVERLAY_SYSTEM.md         ← ±40 point adjustment logic
├── EDGE_CASE_PROTOCOLS.md    ← Diamond, Nuclear, Lightly Raced, Late-Breaking
├── BETTING_TIERS.md          ← Three-tier structure and bet construction
└── TRACK_INTELLIGENCE.md     ← Schema definition + integration
```

---

## QUICK REFERENCE

### System Flow

```
┌─────────────────┐
│   DRF FILE      │ ← Raw data input (1,435 fields per horse)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DRF PARSER     │ ← Extracts data per DRF_FIELD_MAP.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ TRACK LOOKUP    │ ← Retrieves track data per TRACK_INTELLIGENCE.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SCORING ENGINE  │ ← Calculates 0-336 base per ALGORITHM_V3_SUMMARY.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OVERLAY SYSTEM  │ ← Applies ±40 adjustments per OVERLAY_SYSTEM.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ EDGE CASES      │ ← Checks special protocols per EDGE_CASE_PROTOCOLS.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BETTING TIERS   │ ← Generates recommendations per BETTING_TIERS.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FINAL OUTPUT    │ ← Race analysis + betting strategy
└─────────────────┘
```

---

## DOCUMENT SUMMARIES

### 0. ALGORITHM_V3_SUMMARY.md (PRIMARY REFERENCE)

**Purpose:** Current algorithm implementation (v3.6, Phases 1-7)

**Key Contents:**

- 336-point base score with 15 categories
- Category weights: Speed (90), Form (50), Pace (45), Class (32), Connections (27), etc.
- Phase 1-7 changes documented
- Form Decay System (Phase 7) - scales winner bonuses by recency
- Overlay system (±40 pts)
- Data completeness and low confidence penalties
- Proven horse protection
- Odds factor integration (0-15 pts)
- Score interpretation guide

**When to Reference:** Understanding current algorithm, validating scores, debugging

---

### 1. SCORING_ENGINE.md

**Purpose:** Detailed scoring reference with v2.0 legacy documentation and v3.6 notes

**Key Contents:**

- Category 1: Elite Connections (50 pts max)
- Category 2: Post Position & Track Bias (45 pts max)
- Category 3: Speed Figures & Class (50 pts max)
- Category 4: Form Cycle & Conditioning (50 pts max, includes Form Decay v3.6)
- Category 5: Equipment & Medication (25 pts max)
- Category 6: Pace & Tactical (40 pts max)
- Form Decay System (v3.6) - WLO decay tiers, pattern multipliers
- Score categorization thresholds
- Quality control verification

**When to Reference:** Understanding how horses are scored, point allocations, category calculations

---

### 2. DRF_FIELD_MAP.md

**Purpose:** Complete mapping of all 1,435 DRF file fields

**Key Contents:**

- 26 sections covering all data points
- Field numbers, names, and purposes
- Category mapping (which fields feed which scoring category)
- Data quality protocols
- Missing data handling

**When to Reference:** Parser development, understanding DRF data structure, debugging field extraction

---

### 3. OVERLAY_SYSTEM.md

**Purpose:** Defines the ±40 point race-day adjustment system (Phase 5: reduced from ±50)

**Key Contents:**

- Section A: Pace Dynamics & Bias (±10 pts, reduced from ±20)
- Section B: Form Cycle & Conditioning (±15 pts)
- Section C: Trip Analysis & Trouble (±10 pts, reduced from ±12)
- Section D: Class Movement & Competition (±12 pts, reduced from ±15)
- Section E: Connection Micro-Edges (±8 pts, reduced from ±10)
- Section F: Distance & Surface Optimization (±6 pts, reduced from ±8)
- Section G: Head-to-Head & Tactical Matchups (±6 pts, reduced from ±8)
- Section H: Market Intelligence (confidence modifier)
- Overlay cap (±40) and overflow handling
- Pace Pressure Index (PPI) calculation

**When to Reference:** Race-specific adjustments, pace analysis, trip note interpretation

---

### 4. EDGE_CASE_PROTOCOLS.md

**Purpose:** Handles special situations outside standard scoring

**Key Contents:**

- Protocol 1: Diamond in the Rough (120-139 point horses with extreme value)
- Protocol 2: Lightly Raced Enhancement (<8 starts, breeding analysis)
- Protocol 3: Nuclear Longshot Detection (25/1+ with specific angle)
- Protocol 4: Late-Breaking Information (scratches, weather, equipment)
- Protocol priority order and stacking rules
- Betting adjustments for edge cases

**When to Reference:** Sub-threshold horses with potential, first-time starters, longshot analysis, late changes

---

### 5. BETTING_TIERS.md

**Purpose:** Three-tier betting structure and output formatting

**Key Contents:**

- Tier 1: Cover Chalk (180+ points, foundation bets)
- Tier 2: Logical Alternatives (160-179 points, value plays)
- Tier 3: Value Bombs (140-159 points, longshot specials)
- Complete bet construction examples
- Output formatting templates
- Daily card optimization
- Bankroll management protocols

**When to Reference:** Bet sizing, exotic construction, output display, daily strategy

---

### 6. TRACK_INTELLIGENCE.md

**Purpose:** Track database schema and scoring integration

**Key Contents:**

- TrackData interface definition
- Post position bias matrices
- Speed bias data structure
- Par times by distance
- Elite connections schema
- Seasonal patterns
- Fallback handling for unknown tracks
- Track priority list (40+ tracks)

**When to Reference:** Adding new tracks, understanding track-specific adjustments, schema validation

---

## SCORING THRESHOLDS

| Final Score | Category        | Betting Tier  | Action                   |
| ----------- | --------------- | ------------- | ------------------------ |
| 200+        | Elite           | Tier 1        | Maximum confidence plays |
| 180-199     | Strong          | Tier 1        | Foundation betting       |
| 160-179     | Competitive     | Tier 2        | Value seeking            |
| 140-159     | Marginal        | Tier 3        | Selective longshots      |
| 120-139     | Sub-threshold   | Diamond Check | Special review only      |
| <120        | Non-competitive | Pass          | No betting consideration |

---

## FORMULA QUICK REFERENCE

### Final Score Calculation (Algorithm v3.1)

```
Final Score = Base Score (0-336) + Overlay Adjustment (±40)

Theoretical Range: 0 to 376
Practical Range: 50 to 320
Betting Threshold: 140+ minimum

Base Score Categories (336 pts total):
- Speed/Class: 122 pts (37.2%)
- Form: 50 pts (15.2%)
- Pace: 45 pts (13.7%)
- Connections: 27 pts (8.2%)
- Distance/Surface: 20 pts (6.1%)
- Odds Factor: 15 pts (4.6%)
- Post Position: 12 pts (3.7%)
- Trainer Patterns: 10 pts (3.0%)
- Equipment: 8 pts (2.4%)
- Other bonuses: 19 pts (Track Specialist, Trainer S/D, Combos, Weight, P3)

See ALGORITHM_V3_SUMMARY.md for complete category breakdown.
```

### Pace Pressure Index (PPI)

```
PPI = Sum of Quirin Pace Points for top 4 speed horses

Hot Pace: PPI ≥ 28
Moderate-Hot: PPI 22-27
Honest Pace: PPI 16-21
Soft Pace: PPI 10-15
Dead Pace: PPI ≤ 9
```

### Overlay Assessment

```
Overlay % = ((Fair Odds - Current Odds) / Current Odds) × 100

Minimum for Tier 2: 20% overlay
Minimum for Tier 3: 50% overlay
Nuclear threshold: 200%+ overlay at 25/1+
```

### Key Race Index (KRI)

```
KRI = Number of next-out winners from horse's last race
(Within 45 days, equal or higher class, same surface preferred)

KRI 5+: +12 points (exceptional form race)
KRI 4: +10 points
KRI 3: +8 points
KRI 2: +5 points
KRI 1: +2 points
KRI 0: -3 points
```

---

## IMPLEMENTATION CHECKLIST

### Core System (Required)

- [ ] DRF Parser (extracts all 1,435 fields)
- [ ] Track Intelligence Database (minimum 10 major tracks)
- [ ] Scoring Engine (6 categories implemented)
- [ ] Overlay Calculator (all 7 sections)
- [ ] Betting Tier Assignment
- [ ] Output Formatter

### Edge Cases (Required)

- [ ] Diamond Detection Protocol
- [ ] Lightly Raced Enhancement
- [ ] Nuclear Longshot Detection
- [ ] Late-Breaking Handler

### Enhancements (Recommended)

- [ ] Multi-race exotic optimization (Pick 3/4/5)
- [ ] Daily card analysis
- [ ] Bankroll tracking
- [ ] Historical performance logging
- [ ] Weather API integration

---

## MAINTENANCE NOTES

### Document Updates

When updating methodology:

1. Update the relevant document
2. Increment version number at document bottom
3. Update this index if structure changes
4. Ensure no cross-document conflicts

### Track Database Updates

Recommended update frequency:

- Elite connections: Quarterly
- Post position bias: Annually (or after track changes)
- Speed bias: Seasonally
- Par times: Annually

### Version History

| Version | Date    | Changes                                                     |
| ------- | ------- | ----------------------------------------------------------- |
| 3.6     | 2026-01 | v3.6 - Form Decay System - Scales winner bonuses by recency |
| 3.1     | 2025-12 | Algorithm v3.1 (Phase 6): Added ALGORITHM_V3_SUMMARY.md     |
| 3.0     | 2025-12 | Algorithm rebuild Phases 1-5: 336-pt base, overlay cap ±40  |
| 1.0     | 2024-12 | Initial methodology documentation                           |

---

## CONTACT & SUPPORT

**Project:** Furlong
**Type:** PWA Handicapping Application
**Architecture:** React + TypeScript + Vite

**Related Files:**

- `src/lib/drfParser.ts` - DRF parsing implementation
- `src/lib/scoring/index.ts` - Scoring calculations (main entry point)
- `src/lib/scoring/` - Scoring module directory (all category modules)
- `src/data/tracks/` - Track database files
- `MASTER_CONTEXT.md` - Project specification

---

_Document Version: 3.6_
_Status: Complete Methodology Index_
_Purpose: Entry point and navigation for all methodology documentation_
