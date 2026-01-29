# Comprehensive Codebase Audit Report

**Date:** January 29, 2026
**Branch:** `claude/codebase-audit-0UZxh`
**Purpose:** Pre-data-collection lock snapshot of codebase state

---

## EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| Overall Health | **7/10** |
| Critical Issues | **4** |
| Documentation Files | 23 .md, 12 .txt, 10 .yml |
| Test Files | 97 |
| Scoring Modules | 38 |

**Key Finding:** Code uses 336/376 (base/max) but tests expect 330/370 and multiple docs say 331/371. This VALUE DRIFT must be resolved before data collection.

---

## PART 1: DOCUMENTATION AUDIT

### 1.1 Markdown Files (23 total)

| File Path | Last Modified | Status | Action |
|-----------|---------------|--------|--------|
| `MASTER_CONTEXT.md` | 2 days ago | **STALE** (says 331) | UPDATE |
| `ALGORITHM_REFERENCE.md` | 4 hours ago | CURRENT (336/376) | KEEP |
| `UI_AUDIT_BASELINE.md` | 2 days ago | **STALE** (says 331/371) | UPDATE |
| `KNOWN_LIMITATIONS.md` | 2 days ago | **STALE** (says 331/371) | UPDATE |
| `SECURITY.md` | 9 days ago | Current | KEEP |
| `CHANGELOG.md` | 2 days ago | **STALE** (says 331/371) | UPDATE |
| `README.md` | 9 days ago | Current | KEEP |
| `src/docs/SCORING_ENGINE.md` | 5 days ago | **STALE** (says 331) | UPDATE |
| `src/docs/ALGORITHM_V3_SUMMARY.md` | -- | **STALE** (says 331/371) | UPDATE |
| `src/docs/METHODOLOGY_INDEX.md` | 5 days ago | Current | KEEP |
| `src/docs/BETTING_TIERS.md` | 5 days ago | Review needed | REVIEW |
| `src/docs/TRACK_INTELLIGENCE.md` | 9 days ago | Current | KEEP |
| `src/docs/DRF_FIELD_MAP.md` | 9 days ago | Current | KEEP |
| `src/docs/OVERLAY_SYSTEM.md` | 5 days ago | Current | KEEP |
| `src/docs/EDGE_CASE_PROTOCOLS.md` | 5 days ago | Current | KEEP |
| `src/docs/TREND_RANK.md` | -- | Current | KEEP |
| `src/docs/BLENDED_RANK.md` | -- | Current | KEEP |
| `src/data/README.md` | -- | Current | KEEP |
| `src/data/tracks/TRACK_INTELLIGENCE.md` | -- | Current | KEEP |
| `docs/HORSE_RACING_PITCH_OVERVIEW.md` | 4 days ago | Current | KEEP |
| `docs/AI_TESTING.md` | 9 days ago | Current | KEEP |
| `docs/audits/2026-01-23-ai-validation-routing-audit.md` | 6 days ago | Current | KEEP |
| `.github/pull_request_template.md` | -- | Current | KEEP |

### 1.2 Text Files (12 total)

All result data files in `src/data/`:
- `TUP1230_results.txt`, `PEN1219_results.txt`, `SAX1228_results.txt`
- `DED1230_results.txt`, `GPX1224_results.txt`, `PEN0821_results.txt`
- `SAX1229_results.txt`, `AQU1228_results.txt`, `PRX1230_results.txt`
- `PRX1229_results.txt`, `FGX1228_results.txt`, `GPX1227_results.txt`

**Status:** Current validation data - KEEP ALL

### 1.3 YAML Files (10 total)

| File | Purpose | Status |
|------|---------|--------|
| `.github/workflows/quality.yml` | PR quality checks | KEEP |
| `.github/workflows/algorithm-validation.yml` | Algorithm tests | KEEP |
| `.github/workflows/ci.yml` | Main CI pipeline | KEEP |
| `.github/workflows/e2e.yml` | E2E tests | KEEP |
| `.github/workflows/security.yml` | Security scanning | KEEP |
| `.github/workflows/lighthouse.yml` | Performance audit | KEEP |
| `.github/workflows/deploy.yml` | Vercel deployment | KEEP |
| `.github/workflows/ai-validation.yml` | AI validation | KEEP |
| `.github/dependabot.yml` | Dependency updates | KEEP |
| `pnpm-lock.yaml` | Lock file | KEEP |

---

## PART 2: SCORING CONSTANTS AUDIT

### 2.1 MAX_BASE_SCORE Locations

| Location | Value | Status |
|----------|-------|--------|
| `src/lib/scoring/index.ts:190` | **336** | ✓ CURRENT |
| `src/lib/scoring/scoringUtils.ts:29` | **336** | ✓ CURRENT |
| `ALGORITHM_REFERENCE.md:64` | **336** | ✓ CURRENT |
| `src/docs/ALGORITHM_V3_SUMMARY.md:16` | 331 | ⚠️ STALE |
| `src/docs/SCORING_ENGINE.md:59` | 331 | ⚠️ STALE |
| `UI_AUDIT_BASELINE.md:742` | 331 | ⚠️ STALE |
| `KNOWN_LIMITATIONS.md:28` | 331 | ⚠️ STALE |
| `CHANGELOG.md:18` | 331 | ⚠️ STALE |
| `algorithmValidation.test.ts:92` | expects 330 | ❌ WILL FAIL |
| `tierClassification.ts:28` comment | says 330 | ⚠️ STALE |

### 2.2 MAX_SCORE Locations

| Location | Value | Status |
|----------|-------|--------|
| `src/lib/scoring/index.ts:199` | **376** | ✓ CURRENT |
| `ALGORITHM_REFERENCE.md:66` | **376** | ✓ CURRENT |
| `src/docs/ALGORITHM_V3_SUMMARY.md:18` | 371 | ⚠️ STALE |
| `UI_AUDIT_BASELINE.md:742` | 371 | ⚠️ STALE |
| `algorithmValidation.test.ts:93` | expects 370 | ❌ WILL FAIL |
| `index.test.ts:157` | comment says 371 | ⚠️ STALE |

### 2.3 Tier Threshold Inconsistencies

**ALGORITHM_REFERENCE.md (336 base):**
```
Tier 1: 181+ (54% of 336)
Tier 2: 161-180 (48% of 336)
Tier 3: 131-160 (39% of 336)
```

**tierClassification.ts (uses 330):**
```typescript
tier1: { minScore: 178 }  // 54% of 330
tier2: { minScore: 158 }  // 48% of 330
tier3: { minScore: 129 }  // 39% of 330
```

**⚠️ MISMATCH:** Tier thresholds calculated from 330, not 336!

### 2.4 Current Category Point Allocation

| Category | Points | % | Source |
|----------|--------|---|--------|
| Speed & Class | 140 | 41.7% | speedClass.ts |
| Form | 50 | 14.9% | form.ts |
| Pace | 45 | 13.4% | pace.ts |
| Connections | 24 | 7.1% | connections.ts |
| Distance/Surface | 20 | 6.0% | distanceSurface.ts |
| Post Position | 12 | 3.6% | postPosition.ts |
| Track Specialist | 10 | 3.0% | distanceSurface.ts |
| Combo Patterns | 10 | 3.0% | comboPatterns.ts |
| Trainer Patterns | 8 | 2.4% | trainerPatterns.ts |
| Equipment | 8 | 2.4% | equipment.ts |
| Trainer S/D | 6 | 1.8% | connections.ts |
| P3 Refinements | 2 | 0.6% | p3Refinements.ts |
| Weight | 1 | 0.3% | weight.ts |
| **TOTAL** | **336** | 100% | index.ts |

---

## PART 3: DEAD CODE AUDIT

### 3.1 Disabled Modules

| Module | Location | Status | Notes |
|--------|----------|--------|-------|
| `workouts.ts` | `src/lib/scoring/workouts.ts` | DISABLED | Regression: win rate 16.5%→12.8% |
| Import | `src/lib/scoring/index.ts:154` | Commented | Preserved for future |

### 3.2 Deprecated Items

| Item | Location | Reason |
|------|----------|--------|
| Type aliases | `src/types/drf.ts:776-794` | Backward compatibility |
| Field spread adjustments | `src/lib/scoring/fieldSpread.ts:83-135` | v3.8 removed |
| `paceScenario.ts` | Full module | Consolidated into pace.ts |
| Form helpers | `src/lib/scoring/form.ts:968-1598` | Replaced by v3.7 system |
| Expansion model | `src/services/ai/index.ts:1424-3679` | Replaced |
| Value colors | `src/lib/value/valueTagMatrix.ts:181-188` | UI change |

### 3.3 Outstanding TODOs

| Location | Description |
|----------|-------------|
| `e2e/app.spec.ts:38,49,56` | Rewrite selectors after UI overhaul |
| `src/lib/scoring/overlayPipeline.ts:912` | Connect to calibration storage |
| `src/services/payments/index.ts:358` | Return Stripe implementation |

---

## PART 4: TEST AUDIT

### 4.1 Test File Summary

| Type | Count |
|------|-------|
| Unit tests (`.test.ts`) | 96 |
| E2E tests (`.spec.ts`) | 1 |
| **Total** | **97** |

### 4.2 Test Execution

- **Could not run:** `node_modules` not installed
- **Last known (per CHANGELOG):** 3176 tests, 0 failures (Jan 26, 2026)

### 4.3 Tests with Outdated Expectations

| Test File | Issue |
|-----------|-------|
| `algorithmValidation.test.ts:92` | `expect(MAX_BASE_SCORE).toBe(330)` - code is 336 |
| `algorithmValidation.test.ts:93` | `expect(MAX_SCORE).toBe(370)` - code is 376 |
| `algorithmValidation.test.ts:55` | `comboPatterns: 4` - code is 10 |
| `algorithmValidation.test.ts:62` | Sum expects 330 |
| Multiple overlay tests | Comments say "331 per ALGORITHM_REFERENCE" |
| `tierClassification.test.ts:429,436,443` | Comments reference 330 |
| `index.test.ts:157` | Comment says "MAX_SCORE (371)" |

---

## PART 5: TYPE AUDIT

### 5.1 `any` Type Usage

- **Scoring files:** 0 instances ✓
- **Overall:** Clean TypeScript

### 5.2 Deprecated Types

| Location | Item | Notes |
|----------|------|-------|
| `src/types/drf.ts:776` | `RaceHeader` alias | Backward compat |
| `src/types/drf.ts:785` | `HorseEntry` alias | Backward compat |
| `src/types/drf.ts:794` | `ParsedDRFFile` alias | Backward compat |

### 5.3 Removed Properties

- `oddsScore` - Properly removed from base scoring
- Odds data preserved in overlay system

---

## PART 6: DEPENDENCY AUDIT

### 6.1 Production Dependencies (7)

| Package | Version | Status |
|---------|---------|--------|
| `@supabase/supabase-js` | ^2.89.0 | Auth scaffolding |
| `@testing-library/dom` | ^10.4.1 | Testing |
| `framer-motion` | ^12.23.26 | Animations |
| `material-icons` | ^1.13.14 | Icons |
| `react` | ^19.2.0 | Core |
| `react-dom` | ^19.2.0 | Core |
| `recharts` | ^3.6.0 | Charts |

### 6.2 Audit Status

- Cannot verify without `npm audit` (no node_modules)
- Dependabot configured for automated updates

---

## PART 7: ARCHITECTURE AUDIT

### 7.1 Scoring Pipeline

```
DRF File → drfParser.ts
    ↓
calculateRaceScores (index.ts)
    ↓
┌─────────────────────────────────────────┐
│ Category Modules:                       │
│ speedClass.ts     → 140 pts            │
│ form.ts           → 50 pts             │
│ pace.ts           → 45 pts             │
│ connections.ts    → 24 pts             │
│ distanceSurface.ts → 20 pts            │
│ postPosition.ts   → 12 pts             │
│ (track specialist) → 10 pts            │
│ comboPatterns.ts  → 10 pts             │
│ trainerPatterns.ts → 8 pts             │
│ equipment.ts      → 8 pts              │
│ (trainer S/D)     → 6 pts              │
│ p3Refinements.ts  → 2 pts              │
│ weight.ts         → 1 pt               │
└─────────────────────────────────────────┘
    ↓
Base Score (capped at 336)
    ↓
overlayScoring.ts → Overlay (±40)
    ↓
Final Score (capped at 376)
    ↓
tierClassification.ts → Betting Tiers
```

### 7.2 Scoring Module Count

- Total modules in `src/lib/scoring/`: **38 files**
- Core: index.ts, scoringUtils.ts, diagnostics.ts
- Disabled: workouts.ts

### 7.3 Circular Imports

**Status:** None detected - imports flow downward from index.ts

---

## FINDINGS SUMMARY

### Critical Issues (4)

1. **MAX_BASE_SCORE drift:** Code=336, tests expect 330, docs say 331
2. **MAX_SCORE drift:** Code=376, tests expect 370, docs say 371
3. **comboPatterns:** Code=10 pts, tests expect 4 pts
4. **Tier thresholds:** tierClassification.ts calculated from 330, not 336

### Documentation Needing Updates (7)

1. `MASTER_CONTEXT.md` - Update base score reference
2. `UI_AUDIT_BASELINE.md` - Update 331/371→336/376
3. `KNOWN_LIMITATIONS.md` - Update 331/371→336/376
4. `CHANGELOG.md` - Note 336/376 as current
5. `src/docs/SCORING_ENGINE.md` - Update 331→336
6. `src/docs/ALGORITHM_V3_SUMMARY.md` - Update 331/371→336/376
7. `src/lib/betting/tierClassification.ts` comments

### Dead Code to Preserve

1. `workouts.ts` - Disabled, documented for future use
2. Deprecated functions - Properly marked with @deprecated

### Tests Likely Failing

- `algorithmValidation.test.ts` - Wrong expected values for MAX_BASE_SCORE, MAX_SCORE, comboPatterns

---

## RECOMMENDATIONS

### Before Data Collection Lock:

1. **Fix tests:** Update `algorithmValidation.test.ts` expected values
2. **Fix tier thresholds:** Update `tierClassification.ts` to use 336-based values (181/161/131)
3. **Update docs:** Sync all documentation to 336/376
4. **Run full test suite:** Verify all 3176+ tests pass

### Quality Indicators

| Metric | Status |
|--------|--------|
| TypeScript strictness | ✓ No `any` in scoring |
| Test coverage | ✓ 97 test files |
| Deprecation markers | ✓ Properly used |
| Module organization | ✓ Clean pipeline |
| Documentation | ⚠️ VALUE DRIFT |
| Test accuracy | ❌ WILL FAIL |

---

## OVERALL HEALTH: 7/10

**Good:** Clean architecture, comprehensive tests, proper deprecation
**Critical:** Value drift between code/tests/docs must be resolved

---

_Audit performed by Claude Code on January 29, 2026_
