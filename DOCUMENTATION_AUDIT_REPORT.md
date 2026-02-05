# Documentation Audit Report

**Generated:** 2026-02-05
**Branch:** claude/audit-outdated-docs-XWJCa

---

## PART 1: Current Codebase State

### Component Count
- **Components:** 75 files in `src/components/**/*.tsx`
- **Hooks:** 18 files in `src/hooks/**/*.ts` (excluding tests)
- **Services:** 55+ files in `src/services/**/*.ts` (excluding tests)
- **Lib Modules:** 100+ files in `src/lib/**/*.ts`

### Key Implementation Files Verified
| File Path | Status |
|-----------|--------|
| `src/lib/drfParser.ts` | EXISTS |
| `src/lib/trackIntelligence.ts` | EXISTS |
| `src/lib/scoring/index.ts` | EXISTS |
| `src/lib/scoring/diagnostics.ts` | EXISTS |
| `src/lib/scoring/form.ts` | EXISTS |
| `src/lib/scoring/pace.ts` | EXISTS |
| `src/data/tracks/index.ts` | EXISTS |
| `src/data/tracks/trackSchema.ts` | EXISTS |

### Track Files
40 track files exist in `src/data/tracks/` using **full names** (e.g., `churchillDowns.ts`, `santaAnita.ts`, `gulfstreamPark.ts`).

---

## PART 2: Documentation File Audit

### CURRENT Files (Verified Accurate)

| File | Status | Notes |
|------|--------|-------|
| `README.md` | CURRENT | Correct tech stack, scripts, and workflows |
| `MASTER_CONTEXT.md` | CURRENT | Core project specification |
| `ALGORITHM_REFERENCE.md` | CURRENT | Constants and thresholds reference |
| `src/docs/ALGORITHM_V3_SUMMARY.md` | CURRENT | Documents v4.0 algorithm correctly |
| `src/docs/BLENDED_RANK.md` | CURRENT | Conceptual methodology doc |
| `src/docs/DRF_FIELD_MAP.md` | CURRENT | Field mapping reference |
| `src/docs/BETTING_TIERS.md` | CURRENT | Betting tier methodology |
| `src/docs/EDGE_CASE_PROTOCOLS.md` | CURRENT | Protocol documentation |
| `src/docs/OVERLAY_SYSTEM.md` | CURRENT | Overlay adjustment methodology |
| `src/docs/TREND_RANK.md` | CURRENT | Trend analysis methodology |
| `src/docs/SCORING_ENGINE.md` | CURRENT | Scoring reference |
| `src/data/README.md` | CURRENT | Data directory documentation |
| `docs/AI_TESTING.md` | CURRENT | AI testing documentation |
| `SECURITY.md` | CURRENT | Security policies |
| `CHANGELOG.md` | CURRENT | Version history |

### STALE Files (Outdated Content)

#### 1. `src/docs/TRACK_INTELLIGENCE.md`
**Status:** STALE
**Outdated References:**
- States `trackIntelligence.ts` is in `src/data/tracks/` but it's actually at `src/lib/trackIntelligence.ts`
- States track files are named `[TRACK_CODE].ts` (e.g., `CD.ts`, `SA.ts`, `GP.ts`) but actual files use full names (`churchillDowns.ts`, `santaAnita.ts`, `gulfstreamPark.ts`)

**Recommendation:** UPDATE - Fix file path references in Architecture section

#### 2. `src/docs/METHODOLOGY_INDEX.md`
**Status:** STALE
**Outdated References:**
- Quick Reference section header says "Final Score Calculation (Algorithm v3.1)" but current algorithm is v4.0
- Document version "3.6" doesn't match current algorithm v4.0
- Speed/Class category shows "122 pts (37.2%)" but ALGORITHM_V3_SUMMARY.md shows "140 pts (41.7%)"
- Category breakdown percentages don't match current algorithm weights

**Recommendation:** UPDATE - Sync Quick Reference section with ALGORITHM_V3_SUMMARY.md v4.0 values

---

## PART 3: Orphaned Test Data Files

The following 12 `*_results.txt` files in `src/data/` have **NO references** anywhere in the codebase:

| File | Orphaned | Recommendation |
|------|----------|----------------|
| `src/data/FGX1228_results.txt` | YES | REMOVE |
| `src/data/GPX1224_results.txt` | YES | REMOVE |
| `src/data/AQU1228_results.txt` | YES | REMOVE |
| `src/data/PEN1219_results.txt` | YES | REMOVE |
| `src/data/PRX1229_results.txt` | YES | REMOVE |
| `src/data/DED1230_results.txt` | YES | REMOVE |
| `src/data/PEN0821_results.txt` | YES | REMOVE |
| `src/data/PRX1230_results.txt` | YES | REMOVE |
| `src/data/GPX1227_results.txt` | YES | REMOVE |
| `src/data/SAX1228_results.txt` | YES | REMOVE |
| `src/data/SAX1229_results.txt` | YES | REMOVE |
| `src/data/TUP1230_results.txt` | YES | REMOVE |

**Evidence:** Grep search for these file names and `_results` pattern in `src/**/*.{ts,tsx}` returned no import or reference matches.

---

## PART 4: Duplicate Documentation Files

### Duplicate Found: TRACK_INTELLIGENCE.md

| Location | Version | Last Updated |
|----------|---------|--------------|
| `src/docs/TRACK_INTELLIGENCE.md` | 1.1 | December 2025 |
| `src/data/tracks/TRACK_INTELLIGENCE.md` | 1.0 | (not specified) |

**Differences:**
- v1.1 (`src/docs/`) includes "Available Data Getter Functions" table with 12 documented functions
- v1.0 (`src/data/tracks/`) lacks the getter functions documentation
- v1.1 has additional sections for drainage factors and stretch length factors

**Recommendation:**
- **KEEP:** `src/docs/TRACK_INTELLIGENCE.md` (v1.1 - more complete and current)
- **REMOVE:** `src/data/tracks/TRACK_INTELLIGENCE.md` (v1.0 - outdated duplicate)

---

## PART 5: Summary

### Files by Recommendation

#### KEEP (No Changes Needed)
- `README.md`
- `MASTER_CONTEXT.md`
- `ALGORITHM_REFERENCE.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `KNOWN_LIMITATIONS.md`
- `src/docs/ALGORITHM_V3_SUMMARY.md`
- `src/docs/BLENDED_RANK.md`
- `src/docs/DRF_FIELD_MAP.md`
- `src/docs/BETTING_TIERS.md`
- `src/docs/EDGE_CASE_PROTOCOLS.md`
- `src/docs/OVERLAY_SYSTEM.md`
- `src/docs/TREND_RANK.md`
- `src/docs/SCORING_ENGINE.md`
- `src/data/README.md`
- `docs/AI_TESTING.md`
- `docs/HORSE_RACING_PITCH_OVERVIEW.md`
- `.github/pull_request_template.md`

#### UPDATE (Fix Stale Content)
| File | Issue |
|------|-------|
| `src/docs/TRACK_INTELLIGENCE.md` | Fix file path references (trackIntelligence.ts location, track file naming) |
| `src/docs/METHODOLOGY_INDEX.md` | Update Quick Reference to v4.0 algorithm values |

#### REMOVE (Duplicate or Orphaned)
| File | Reason |
|------|--------|
| `src/data/tracks/TRACK_INTELLIGENCE.md` | Duplicate (v1.0 superseded by v1.1 in src/docs/) |
| `src/data/FGX1228_results.txt` | Orphaned test data |
| `src/data/GPX1224_results.txt` | Orphaned test data |
| `src/data/AQU1228_results.txt` | Orphaned test data |
| `src/data/PEN1219_results.txt` | Orphaned test data |
| `src/data/PRX1229_results.txt` | Orphaned test data |
| `src/data/DED1230_results.txt` | Orphaned test data |
| `src/data/PEN0821_results.txt` | Orphaned test data |
| `src/data/PRX1230_results.txt` | Orphaned test data |
| `src/data/GPX1227_results.txt` | Orphaned test data |
| `src/data/SAX1228_results.txt` | Orphaned test data |
| `src/data/SAX1229_results.txt` | Orphaned test data |
| `src/data/TUP1230_results.txt` | Orphaned test data |

### Totals
- **Documentation files analyzed:** 23
- **CURRENT:** 18 files
- **STALE (need updates):** 2 files
- **REMOVE (duplicates):** 1 file
- **Orphaned test data files:** 12 files

---

*Report generated by documentation audit on branch claude/audit-outdated-docs-XWJCa*
