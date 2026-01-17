# Handicap App — Algorithm Reference

> **Companion to MASTER_CONTEXT.md** — This document contains all algorithm-specific details that were split out to prevent context truncation.
>
> **Read BOTH documents at the start of every session.**
>
> **Algorithm Version:** v3.6 (Phase 7, Form Decay System)
>
> **Last Updated:** January 2025

---

## The Algorithm

> **Current Version: v3.6 (Phase 7)** — See `src/docs/ALGORITHM_V3_SUMMARY.md` for complete specification.
>
> **IMPLEMENT v3.6 ONLY.** Ignore v2.0 references in legacy documentation.

### Scoring Structure

| Component          | Points                     |
| ------------------ | -------------------------- |
| Base Score         | 0-328                      |
| Overlay Adjustment | ±40 (capped)               |
| **Final Score**    | **0-368** (floor at 0)     |

### Base Score Categories (328 pts total)

| Category              | Points | % of Base |
|-----------------------|--------|-----------|
| Speed Figures         | 90     | 27.4%     |
| Form                  | 50     | 15.2%     |
| Pace                  | 45     | 13.7%     |
| Class                 | 32     | 9.8%      |
| Connections           | 27     | 8.2%      |
| Distance/Surface      | 20     | 6.1%      |
| Odds Factor           | 15     | 4.6%      |
| Post Position         | 12     | 3.7%      |
| Trainer Patterns      | 10     | 3.0%      |
| Equipment             | 8      | 2.4%      |
| Track Specialist      | 6      | 1.8%      |
| Trainer Surface/Dist  | 6      | 1.8%      |
| Combo Patterns        | 4      | 1.2%      |
| P3 Refinements        | 2      | 0.6%      |
| Weight                | 1      | 0.3%      |
| **TOTAL**             | **328**| **100%**  |

**Verification:** 90+50+45+32+27+20+15+12+10+8+6+6+4+2+1 = 328 ✓

### Overlay Adjustments (±40 pts max)

_Applied after base scoring. Individual sections sum to ±67 but are capped at ±40 total._

| Section                          | Max Adjustment |
|----------------------------------|----------------|
| A: Pace Dynamics & Bias          | ±10            |
| B: Form Cycle & Conditioning     | ±15            |
| C: Trip Analysis & Trouble       | ±10            |
| D: Class Movement & Competition  | ±12            |
| E: Connection Micro-Edges        | ±8             |
| F: Distance & Surface Opt.       | ±6             |
| G: Head-to-Head & Tactical       | ±6             |

**Cap Rule:** Sum of all overlay adjustments is clamped to ±40.
**Floor Rule:** Final score cannot go below 0.

### Confidence Calculation

Confidence reflects data completeness, affecting score reliability:

| Confidence | Data Completeness | Effect |
|------------|-------------------|--------|
| HIGH       | 80-100%           | Full scoring confidence |
| MEDIUM     | 60-79%            | Minor uncertainty flag |
| LOW        | <60%              | 15% base score penalty applied |

**Data Completeness Inputs:**

- **Critical Fields (50% weight):** Speed figures, past performances, class levels, days since last race
- **Important Fields (35% weight):** Running style, track/distance experience, trainer/jockey info, workout data
- **Minor Fields (15% weight):** Weight changes, equipment changes, medication changes

### Betting Tiers

| Tier             | Score   | Confidence | Hit Rate | Action         |
| ---------------- | ------- | ---------- | -------- | -------------- |
| 1 (Chalk)        | 180+    | High       | 50-70%   | Primary bets   |
| 2 (Alternatives) | 160-179 | Medium     | 20-40%   | Secondary bets |
| 3 (Value)        | 140-159 | Lower      | 5-20%    | Small stabs    |
| Diamond Check    | 120-139 | Special    | Variable | Review if 200%+ overlay |
| Pass             | <120    | —          | —        | No bet         |

### Edge Case Protocols

- **Diamond in the Rough:** 120-139 pts with extreme overlay (200%+) gets special review
- **Lightly Raced:** <8 starts triggers breeding-based compensation
- **Nuclear Longshot:** 25/1+ with specific angle gets separate evaluation
- **Late Changes:** Scratches/equipment/jockey changes trigger full recalculation

### Recalculation Triggers

The following changes trigger automatic score recalculation:

- Horse scratched
- Odds update (manual input)
- Track condition change
- Equipment change
- Jockey change
- Weather impact toggle

UI shows loading indicator during recalculation. Debounced at 300ms.

---

## DRF File Format

### Structure

- CSV format, 1,435 fields per line
- One line per horse entry
- ASCII encoding
- Purchased from DRF.com

### Key Field Groups

| Fields    | Content                                             |
| --------- | --------------------------------------------------- |
| 1-27      | Race header (track, date, distance, surface, purse) |
| 28-57     | Horse identity (trainer, jockey, breeding)          |
| 62-101    | Lifetime records (starts, wins, earnings)           |
| 102-113   | Past performance dates (up to 12)                   |
| 114-700   | PP details (figures, positions, equipment, margins) |
| 700-900   | Pace figures, fractional times                      |
| 900-1100  | Trainer/jockey names per PP                         |
| 1100-1435 | Workouts, extended stats, comments                  |

### Critical Scoring Fields (Exact Indices)

| Data             | Field Range | Notes                    |
|------------------|-------------|--------------------------|
| Speed Figures    | 766-775     | 10 most recent PPs       |
| Variant Speed    | 776-785     | Track variant adjusted   |
| Early Pace (EP1) | 816-825     | First call pace figures  |
| Late Pace        | 846-855     | Final fraction pace      |
| Average Pace     | 856-865     | Computed average         |
| Running Style    | 210         | Single field             |
| Equipment        | 162-173     | Current + 10 PP history  |
| Track Condition  | 150-161     | Current + 10 PP history  |
| Quarter Times    | 866-875     | Fractional splits        |
| Half-Mile Times  | 896-905     | Fractional splits        |
| Six Furlong      | 906-915     | Fractional splits        |
| Mile Times       | 916-925     | Fractional splits        |

### DRF Parsing Error Handling

| Error Type | Behavior |
|------------|----------|
| Missing required fields | Skip horse, log warning, continue parsing |
| Invalid numeric values | Use fallback (0 or null), flag in UI |
| Encoding issues | Attempt UTF-8 fallback, then ASCII strip |
| Truncated lines | Skip entry, log error |
| Corrupted file | Abort parse, show user-friendly error |

---

## Track Intelligence

### Data Structure

```typescript
interface TrackIntelligence {
  code: string;              // "CD", "SAR", "GP"
  name: string;              // "Churchill Downs"
  location: string;          // "Louisville, KY"

  surface: {
    main: {
      material: string;
      circumference: number; // feet
      stretch: number;       // feet
    };
    turf?: { ... };
  };

  bias: {
    sprint: {
      speedBias: number;     // 0-100 (50 = neutral, >50 = favors speed)
      postPositionWinRates: number[];
      goldenPosts: number[];
    };
    route: { ... };
    turf?: { ... };
  };

  pars: {
    [distance: number]: {
      quarter: number;
      half: number;
      final: number;
    };
  };
}
```

### Storage

```
src/data/tracks/
├── index.ts          # Exports Map<string, TrackIntelligence>
├── schema.ts         # TypeScript interfaces
└── [trackCode].ts    # Individual track files
```

### Fallback

Unknown tracks get:

- 50 speedBias (neutral)
- Even post distribution
- National average pars
- Reduced confidence flag (LOW)

Corrupted/nonsensical track codes: Treat as unknown, log warning.

---

## Quick Reference Summary

### Score Math

```
Base Score (15 categories) = 0-328 pts
Overlay Adjustment = ±40 pts (capped)
Final Score = Base + Overlay = 0-368 pts
```

### Top 5 Categories by Weight

1. Speed Figures: 90 pts (27.4%)
2. Form: 50 pts (15.2%)
3. Pace: 45 pts (13.7%)
4. Class: 32 pts (9.8%)
5. Connections: 27 pts (8.2%)

These five account for 244 of 328 base points (74.4%).

### Key DRF Fields (Most Used)

| Data | Index |
|------|-------|
| Running Style | 210 |
| Speed Figures | 766-775 |
| Early Pace | 816-825 |
| Late Pace | 846-855 |
| Track Condition | 150-161 |
| Equipment | 162-173 |

### Tier Thresholds

| Tier | Score Range |
|------|-------------|
| Tier 1 (Chalk) | 180+ |
| Tier 2 (Alternatives) | 160-179 |
| Tier 3 (Value) | 140-159 |
| Diamond Check | 120-139 |
| Pass | <120 |

### Confidence Thresholds

| Level | Data Completeness | Penalty |
|-------|-------------------|---------|
| HIGH | 80-100% | None |
| MEDIUM | 60-79% | None |
| LOW | <60% | 15% base score reduction |

---

## Methodology Documentation Index

For detailed specifications, see these files in `src/docs/`:

| Document | Contains |
|----------|----------|
| METHODOLOGY_INDEX.md | Master index linking all docs |
| ALGORITHM_V3_SUMMARY.md | Full v3.6 algorithm specification |
| SCORING_ENGINE.md | Detailed scoring formulas |
| DRF_FIELD_MAP.md | Complete 1,435 field mapping |
| OVERLAY_SYSTEM.md | Race-day adjustment details |
| EDGE_CASE_PROTOCOLS.md | Diamond, Nuclear, Lightly Raced protocols |
| BETTING_TIERS.md | Tier structure and bet construction |
| TRACK_INTELLIGENCE.md | Track schema and integration |
| BLENDED_RANK.md | Blended ranking methodology |
| TREND_RANK.md | Trend analysis methodology |

---

_End of ALGORITHM_REFERENCE.md_
