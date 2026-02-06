# Code Duplication Audit Report

> **Generated:** February 2026
>
> **Scope:** Full codebase audit of `src/` for duplicated components, utilities, types, and styling patterns
>
> **Status:** READ-ONLY AUDIT -- No files were modified

---

## Table of Contents

1. [Duplicated Components](#1-duplicated-components)
2. [Duplicated Utility Functions](#2-duplicated-utility-functions)
3. [Duplicated Type Definitions](#3-duplicated-type-definitions)
4. [Duplicated Styling Patterns](#4-duplicated-styling-patterns)
5. [Consolidation Priority](#5-consolidation-priority)
6. [Metrics](#6-metrics)

---

## 1. Duplicated Components

### 1A. Icon Helper Component -- 9 IDENTICAL/NEAR-IDENTICAL copies

The same `Icon` helper wrapping `<span className="material-icons">` is defined locally in **9 separate component files**.

| File | Line | Variant |
|------|------|---------|
| `src/components/ResetConfirmDialog.tsx` | 15 | Standard (2 props) |
| `src/components/RaceControls.tsx` | 17 | Standard (2 props) |
| `src/components/Toast.tsx` | 25 | Standard (2 props) |
| `src/components/TrendDetailModal.tsx` | 82 | Standard (2 props) |
| `src/components/HorseDetailModal.tsx` | 86 | Standard (2 props) |
| `src/components/CalculationStatus.tsx` | 13 | Standard (2 props) |
| `src/components/ScoringHelpModal.tsx` | 18 | Standard (2 props) |
| `src/components/BettingStrategyGuide.tsx` | 20 | Extended (+style prop) |
| `src/components/ParsingProgress.tsx` | 75 | Extended (+style, +fontFamily, missing aria-hidden) |

**7 files** have byte-for-byte identical implementations. **2 files** add an optional `style` prop. The `ParsingProgress.tsx` variant also sets `fontFamily: 'Material Icons'` explicitly and is missing `aria-hidden="true"`.

**Recommended Action:** **EXTRACT** -- Create `src/components/shared/Icon.tsx` with the superset signature (`name`, `className`, `style`, `size`). Remove all 9 local definitions.

### 1B. TIER_COLORS Constant -- 3 copies

| File | Line |
|------|------|
| `src/components/BettingRecommendations.tsx` | 72 |
| `src/components/ExoticBuilderModal.tsx` | 98 |
| `src/components/MultiRaceBuilderModal.tsx` | 94 |

All three define nearly identical `TIER_COLORS` objects mapping tier levels to `{ bg, border, text }` using the same rgba values for Tier 1/2/3.

**Recommended Action:** **EXTRACT** -- Move to `src/constants/tierColors.ts` or `src/styles/tierColors.ts`.

### 1C. Card Patterns -- Genuinely Different

| Component | File | Purpose |
|-----------|------|---------|
| `BankrollSummaryCard` | `src/components/BankrollSummaryCard.tsx:13` | Bankroll display |
| `BetTypeCard` | `src/components/MultiRaceExoticsPanel.tsx:121` | Multi-race bet type |
| `InteractiveBetCard` | `src/components/BettingRecommendations.tsx:278` | Interactive bet display |
| `CategoryCard` | `src/components/HorseDetailModal.tsx:135` | Score category display |
| `RaceCard` | `src/components/RaceOverview.tsx:219` | Race overview |
| `WindowCard` | `src/components/TrendDetailModal.tsx:540` | Trend window stat |
| `CompactBetCard` | `src/components/TopBets/TopBetsView.tsx:791` | Compact bet display |
| `TopBetCard` | `src/components/TopBets/TopBetCard.tsx:17` | Top bet display |
| `SimpleTopBetCard` | `src/components/TopBets/SimpleTopBetCard.tsx:37` | Simple bet display |
| `RaceOverviewCard` | `src/components/cards/RaceOverviewCard.tsx:88` | Race card w/ weather |
| `BetCard` | `src/components/BetMode/BetCard.tsx:26` | Bet mode card |
| `SkipCard` | `src/components/BetMode/BetCard.tsx:139` | Skip race card |

**Recommended Action:** **LEAVE** -- These are genuinely different components with distinct purposes. However, `TopBetCard` and `SimpleTopBetCard` share a `formatHorseDisplay` function (see utilities section) and the `ScaledTopBet` type (see types section).

### 1D. Modal/Dialog Patterns -- Genuinely Different

| Component | File |
|-----------|------|
| `PostTimeDetailModal` | `src/components/PostTimeCountdown.tsx:278` |
| `KellyHelpModal` | `src/components/KellyHelpModal.tsx:16` |
| `ExoticBuilderModal` | `src/components/ExoticBuilderModal.tsx:108` |
| `ResetConfirmDialog` | `src/components/ResetConfirmDialog.tsx:23` |
| `ScoringHelpModal` | `src/components/ScoringHelpModal.tsx:26` |
| `BetSlipModal` | `src/components/BettingRecommendations.tsx:136` |
| `MultiRaceBuilderModal` | `src/components/MultiRaceBuilderModal.tsx:182` |
| `LegalModal` | `src/components/legal/LegalModal.tsx:37` |
| `HorseDetailModal` | `src/components/HorseDetailModal.tsx:244` |
| `TrendDetailModal` | `src/components/TrendDetailModal.tsx:226` |

**Recommended Action:** **LEAVE** -- Each serves a distinct domain purpose. However, many share similar overlay/backdrop patterns that could benefit from a shared `ModalShell` wrapper.

### 1E. Button Patterns -- No Duplication Found

No duplicated button components were found. `InstallButton` and `QuickPresetButtons` are single-purpose components.

---

## 2. Duplicated Utility Functions

### 2A. formatCurrency -- 6 copies, 3 variants

| File | Line | Variant | Precision |
|------|------|---------|-----------|
| `src/lib/recommendations/windowInstructions.ts` | 93 | A | Conditional: cents for sub-dollar, else whole |
| `src/lib/betting/betRecommendations.ts` | 840 | A | Conditional: cents for sub-dollar, else whole |
| `src/lib/dutch/dutchDisplay.ts` | 95 | B | Always allows up to 2 decimals |
| `src/hooks/useBankroll.ts` | 483 | C | Whole dollars only (0 decimals) |
| `src/components/Dashboard.tsx` | 52 | C | Whole dollars only (0 decimals) |
| `src/components/BankrollSettings.tsx` | 275 | C | Whole dollars only (0 decimals) |

All six use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`. They differ only in `minimumFractionDigits` / `maximumFractionDigits`.

**Recommended Action:** **MERGE** -- Create one `formatCurrency(amount, precision?: 'auto' | 'whole' | 'cents')` in `src/utils/formatters.ts`. **118 total references** across 16 files would benefit.

### 2B. formatOdds / formatOddsDisplay -- 6 implementations, 4 variants

| File | Line | Function | Output Format |
|------|------|----------|---------------|
| `src/utils/formatters.ts` | 150 | `formatOdds` | Decimal display (`3.5`, `12`) |
| `src/components/PPLine.tsx` | 149 | `formatOdds` | Decimal display (near-identical to above) |
| `src/lib/scoring/oddsScore.ts` | 335 | `formatOdds` | Fractional (`3-1`, `7-2`, `Even`) |
| `src/lib/scoring/oddsParser.ts` | 280 | `formatOddsDisplay` | Multi-format (decimal/fractional/american) |
| `src/lib/value/valueDetector.ts` | 283 | `formatOddsDisplay` | Fractional via lookup table |
| `src/lib/longshots/longshotTypes.ts` | 353 | `formatOddsDisplay` | Simplified ratio (`N/1`) |

**Recommended Action:** **MERGE** (partial) -- Consolidate `formatters.ts` and `PPLine.tsx` versions (near-identical). The others serve genuinely different output formats but should use more distinct names.

### 2C. parseOddsToDecimal / parseOddsToNumber -- 3 copies, 2 variants

| File | Line | Function | Default |
|------|------|----------|---------|
| `src/hooks/useValueDetection.ts` | 140 | `parseOddsToNumber` | 10 |
| `src/lib/betting/topBetsGenerator.ts` | 257 | `parseOddsToDecimal` | 10 |
| `src/lib/exotics/exoticPayoutEstimator.ts` | 124 | `parseOddsToDecimal` | 5 |

The first two are essentially identical (string-split parsing, `EVEN`/`EVN` handling, default 10). The third uses regex-based parsing and defaults to 5.

**Recommended Action:** **MERGE** -- Create `parseOddsToDecimal(str, defaultValue?)` in `src/utils/formatters.ts`.

### 2D. getEdgeColor -- 2 IDENTICAL copies

| File | Line |
|------|------|
| `src/hooks/useValueDetection.ts` | 349 |
| `src/components/HorseExpandedView.tsx` | 202 |

Byte-for-byte identical: same thresholds (`>=75`, `>=50`, `>=25`, `>=-25`), same hex colors (`#10b981`, `#22c55e`, `#84cc16`, `#6B7280`, `#ef4444`).

**Recommended Action:** **EXTRACT** -- Move to `src/utils/formatters.ts` or `src/utils/colors.ts`.

### 2E. formatEdge -- 2 near-identical copies

| File | Line | Precision |
|------|------|-----------|
| `src/hooks/useValueDetection.ts` | 341 | Integer (`Math.round`) |
| `src/lib/value/valueDetector.ts` | 698 | 1 decimal (`.toFixed(1)`) |

Both format an edge percentage with `+` prefix. Only differ in precision.

**Recommended Action:** **MERGE** -- `formatEdge(edge, decimals = 0)` in `src/utils/formatters.ts`.

### 2F. formatEVPercent -- 2 near-identical copies

| File | Line | Guard |
|------|------|-------|
| `src/lib/value/valueDetector.ts` | 690 | None |
| `src/lib/scoring/overlayAnalysis.ts` | 1111 | `!Number.isFinite` returns `'--'` |

Same format logic (`+` prefix, `.toFixed(1)`, `%` suffix). Only differ in NaN guard.

**Recommended Action:** **MERGE** -- Single function with NaN guard always included.

### 2G. formatOverlayPercent -- 2 near-identical copies

| File | Line | Precision |
|------|------|-----------|
| `src/lib/scoring/overlayPipeline.ts` | 963 | `.toFixed(1)` |
| `src/lib/scoring/overlayAnalysis.ts` | 1089 | `.toFixed(0)` |

Same structure, different decimal precision.

**Recommended Action:** **MERGE** -- `formatOverlayPercent(percent, decimals = 1)`.

### 2H. formatHorseDisplay -- 2 copies in TopBets

| File | Line |
|------|------|
| `src/components/TopBets/TopBetsView.tsx` | 948 |
| `src/components/TopBets/SimpleTopBetCard.tsx` | 99 |

**Recommended Action:** **EXTRACT** -- Move to `src/components/TopBets/utils.ts`.

### 2I. formatKellyResult -- 2 DIFFERENT implementations

| File | Line | Input Type |
|------|------|------------|
| `src/lib/betting/kellyCalculator.ts` | 432 | `KellyOutput` |
| `src/lib/betting/kellyCriterion.ts` | 528 | `KellyResult` |

Different input types, different return shapes, different Kelly systems.

**Recommended Action:** **LEAVE** -- Genuinely different.

### 2J. formatPercent -- 2 near-identical copies

| File | Line | Sign Prefix |
|------|------|-------------|
| `src/lib/dutch/dutchDisplay.ts` | 118 | Yes (`+` for positive) |
| `src/services/ai/metrics/export.ts` | 30 | No |

**Recommended Action:** **MERGE** -- `formatPercent(value, { decimals?, signed? })`.

### 2K. formatTime -- 3 different implementations

| File | Line | Purpose |
|------|------|---------|
| `src/hooks/usePostTime.ts` | 170 | HH:MM AM/PM from Date |
| `src/components/LoadingState.tsx` | 24 | Seconds countdown display |
| `src/components/layout/TopBar.tsx` | 57 | Time display with `toLocaleTimeString` |

**Recommended Action:** **LEAVE** -- Different purposes.

---

## 3. Duplicated Type Definitions

### 3A. BetType -- 4 CONFLICTING definitions (CRITICAL)

| File | Line | Values |
|------|------|--------|
| `src/hooks/useBankroll.ts` | 10 | `'win_place' \| 'exacta' \| 'trifecta' \| 'superfecta' \| 'multi_race'` |
| `src/lib/betting/betTypes.ts` | 32 | `'WIN' \| 'PLACE' \| 'SHOW' \| 'EXACTA' \| 'EXACTA_BOX' \| 'TRIFECTA_KEY' \| ...` |
| `src/lib/betting/betRecommendations.ts` | 6 | `'win' \| 'place' \| 'show' \| 'exacta_box' \| 'exacta_key_over' \| ...` |
| `src/lib/betting/betRecommender.ts` | 36 | `'WIN' \| 'PLACE' \| 'SHOW'` |

Different casing conventions, different enum values, different scopes. Most dangerous duplication in the codebase.

**Recommended Action:** **MERGE** -- Centralize in `src/types/betting.ts` with one canonical union type. Adapt all consumers.

### 3B. BetRecommendation -- 3 CONFLICTING definitions

| File | Line | Purpose |
|------|------|---------|
| `src/lib/betting/betRecommender.ts` | 46 | Kelly-based individual bet sizing |
| `src/lib/betting/betRecommendations.ts` | 21 | Tier-based display recommendation |
| `src/services/ai/types.ts` | 428 | AI-synthesized bet structure |

**Recommended Action:** **MERGE** -- Rename to `KellyBetRecommendation`, `TierBetRecommendation`, `AIBetRecommendation` and centralize in `src/types/betting.ts`.

### 3C. RaceData -- 2 IDENTICAL definitions

| File | Line |
|------|------|
| `src/components/MultiRaceExoticsPanel.tsx` | 39 |
| `src/components/MultiRaceBuilderModal.tsx` | 53 |

Identical: `{ raceNumber, horses: Array<{horse, index, score}>, postTime? }`.

**Recommended Action:** **EXTRACT** -- Move to `src/types/` or a shared multi-race types file.

### 3D. ScaledTopBet -- 2 definitions (subset relationship)

| File | Line | Extra Fields |
|------|------|-------------|
| `src/components/TopBets/TopBetsView.tsx` | 61 | `kellyAmount?, historicalROI?, historicalHitRate?` |
| `src/components/TopBets/SimpleTopBetCard.tsx` | 16 | None (strict subset) |

**Recommended Action:** **EXTRACT** -- Keep superset version, import everywhere.

### 3E. ScoreBreakdown -- 2 DIFFERENT definitions

| File | Line | Categories |
|------|------|-----------|
| `src/lib/scoring/index.ts` | 295 | Full (~10 categories) |
| `src/lib/scoring/baseScoring.ts` | 6 | Simplified (6 categories) |

**Recommended Action:** **MERGE** -- The `baseScoring.ts` version appears to be an older/simpler version. Should import from or extend the canonical one.

### 3F. EquipmentScoreResult -- 2 DIFFERENT definitions

| File | Line |
|------|------|
| `src/lib/scoring/equipment.ts` | 38 |
| `src/lib/equipment/equipmentScoring.ts` | 57 |

**Recommended Action:** **MERGE** -- Consolidate to one definition; the newer `equipment/equipmentScoring.ts` version appears to be the evolution.

### 3G. Other Name Collisions (lower priority)

| Type | Files | Action |
|------|-------|--------|
| `RaceScoringResult` | `src/types/scoring.ts:798`, `src/services/calibration/predictionLogger.ts:28` | RENAME calibration version |
| `RaceHeader` | `src/types/drf.ts:567`, `src/services/ai/metrics/recorder.ts:21` | Use `Pick<>` instead of redefining |
| `ValuePlay` | `src/hooks/useValueDetection.ts:49`, `src/lib/scoring/overlayAnalysis.ts:117` | RENAME to distinct names |
| `BetSizingConfig` | `src/lib/recommendations/betSizing.ts:40`, `src/lib/betting/betSizer.ts:23` | RENAME to distinct names |
| `SkeletonProps` | `src/components/motion/index.tsx:113`, `src/components/LoadingState.tsx:136` | Merge Skeleton components |

---

## 4. Duplicated Styling Patterns

### 4A. Hardcoded Colors Bypassing Design Tokens (CRITICAL)

The project has a well-defined token system in `src/styles/tokens.css`, but components widely use hardcoded hex values instead:

| Color | Token Equivalent | Inline Occurrences | Files |
|-------|------------------|-------------------|-------|
| `#888` | `--color-text-tertiary` (#6E6E70) | 55 | 3 |
| `#e0e0e0` | `--color-text-secondary` (#B4B4B6) | 35 | 1 (HorseDetailModal) |
| `#1a1a1a` | `--color-elevated` (#1A1A1C) | 12 | 2 |
| `#222` | No token (ad-hoc) | 15 | 2 |
| `#333` | `--color-border-prominent` (#3A3A3C) | 5 | 2 |
| `#22c55e` | `--color-tier-elite` | 9+ | 4 |
| `#36d1da` | `--accent-hover` | 12 | 2 |
| `#ef4444` | `--color-error` | 6+ | 3 |
| `#f59e0b` | `--color-warning` | 3+ | 2 |

Note: Some hardcoded values (`#888`, `#e0e0e0`, `#1a1a1a`) are **different shades** from the design tokens, creating visual inconsistency.

### 4B. Massive Inline Style Objects

| File | `style={{}}` count | Impact |
|------|-------------------|--------|
| `src/components/HorseDetailModal.tsx` | **249** | CRITICAL |
| `src/components/TrendDetailModal.tsx` | **64** | HIGH |

Most frequently repeated inline patterns in HorseDetailModal:
- `{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }` -- ~10 times
- `{ color: '#e0e0e0', fontWeight: 600 }` -- ~8 times
- `{ display: 'flex', alignItems: 'center', gap: '8px' }` -- 7 times
- `{ backgroundColor: '#1a1a1a', ... }` -- ~11 times

### 4C. Conflicting CSS Custom Properties (HIGH)

`--space-*` tokens have **conflicting values** between files:

| Variable | `tokens.css` | `dashboard.css` |
|----------|-------------|-----------------|
| `--space-5` | 24px | 20px |
| `--space-6` | 32px | 24px |
| `--space-8` | 64px | 32px |

Whichever CSS file loads last wins, making spacing unpredictable.

Additionally, duplicate CSS variable declarations exist:
- `--color-primary: #19abb5` defined in both `tokens.css` and `index.css`
- `--color-success`, `--color-warning`, `--color-error` defined in both `tokens.css` and `dashboard.css`
- `--bg-*` and `--text-*` aliases in `dashboard.css` duplicate `--color-*` names in `tokens.css`

### 4D. Hardcoded rgba() Tier Colors

| Pattern | Occurrences | Files |
|---------|-------------|-------|
| `rgba(25, 171, 181, 0.15)` (primary muted) | 20+ | 10+ |
| `rgba(239, 68, 68, 0.15)` (error bg) | 15+ | 8+ |
| `rgba(245, 158, 11, 0.15)` (warning bg) | 10+ | 6+ |
| `rgba(16, 185, 129, 0.15)` (success bg) | 12+ | 5+ |

Token `--color-primary-muted` exists but is used inconsistently.

### 4E. Material Icons Size Overrides

`material-icons` appears **416 times across 69 files**. Size overrides are scattered across 20+ CSS files with component-specific selectors. The `Dashboard.css` alone has 17 selectors targeting `.material-icons`.

---

## 5. Consolidation Priority

### Priority 1 -- HIGH IMPACT, LOW RISK

| # | Item | Type | Files Affected | Est. Lines Removable | Risk |
|---|------|------|---------------|---------------------|------|
| 1 | Shared `Icon` component | Component | 9 | ~60 | LOW |
| 2 | Shared `formatCurrency` | Utility | 16 (118 refs) | ~50 | LOW |
| 3 | Shared `parseOddsToDecimal` | Utility | 3 | ~40 | LOW |
| 4 | Shared `getEdgeColor` | Utility | 2 | ~15 | LOW |
| 5 | Shared `TIER_COLORS` constant | Constant | 3 | ~30 | LOW |
| 6 | Extract `RaceData` type | Type | 2 | ~10 | LOW |
| 7 | Extract `ScaledTopBet` type | Type | 2 | ~10 | LOW |

### Priority 2 -- HIGH IMPACT, MEDIUM RISK

| # | Item | Type | Files Affected | Est. Lines Removable | Risk |
|---|------|------|---------------|---------------------|------|
| 8 | Consolidate `BetType` definitions | Type | 4+ definitions, 20+ consumers | ~30 | MEDIUM |
| 9 | Consolidate `BetRecommendation` names | Type | 3 definitions, 15+ consumers | ~20 | MEDIUM |
| 10 | Resolve conflicting `--space-*` CSS variables | CSS | 2 CSS files, all components | ~20 | MEDIUM |
| 11 | Deduplicate CSS variable declarations | CSS | 3 CSS files | ~40 | MEDIUM |
| 12 | Merge `formatEdge` | Utility | 2 | ~10 | LOW |
| 13 | Merge `formatEVPercent` | Utility | 2 | ~10 | LOW |
| 14 | Merge `formatOverlayPercent` | Utility | 2 | ~10 | LOW |
| 15 | Merge `formatPercent` | Utility | 2 | ~10 | LOW |
| 16 | Merge `formatOdds` (formatters + PPLine) | Utility | 2 | ~15 | LOW |

### Priority 3 -- MEDIUM IMPACT, HIGHER RISK

| # | Item | Type | Files Affected | Est. Lines Removable | Risk |
|---|------|------|---------------|---------------------|------|
| 17 | Replace hardcoded colors with tokens | Styling | 10+ components | ~150 (refactor) | MEDIUM |
| 18 | Extract CSS classes for repeated inline styles | Styling | 2 major components | ~200+ (refactor) | MEDIUM |
| 19 | Consolidate `ScoreBreakdown` | Type | 2 | ~10 | MEDIUM |
| 20 | Consolidate `EquipmentScoreResult` | Type | 2 | ~15 | MEDIUM |
| 21 | Rename type collisions (ValuePlay, BetSizingConfig, etc.) | Type | 5 pairs | ~0 (rename only) | MEDIUM |

### Priority 4 -- ARCHITECTURAL (Future)

| # | Item | Type | Notes |
|---|------|------|-------|
| 22 | Shared `ModalShell` wrapper | Component | 10 modals share overlay/backdrop pattern |
| 23 | Centralize betting types to `src/types/betting.ts` | Type | 12+ domain types scattered across lib |
| 24 | Establish single CSS token authority | CSS | `tokens.css` should be sole source of truth |
| 25 | Create icon size utility classes | CSS | Replace 20+ scattered `.material-icons` size overrides |

---

## 6. Metrics

### Duplication Summary

| Category | Duplicated Patterns Found | Files Affected |
|----------|--------------------------|----------------|
| Components | 2 (Icon, TIER_COLORS) | 12 |
| Utility Functions | 11 groups | 30+ |
| Type Definitions | 11 name collisions (1 identical, 10 conflicting) | 22+ |
| Styling Patterns | 6 major patterns | 40+ |
| **Total** | **30 duplication patterns** | **60+ files** |

### Estimated Impact

| Metric | Value |
|--------|-------|
| Total duplicated patterns found | 30 |
| Unique files affected | 60+ |
| Estimated lines removable (Priority 1-2) | ~370 |
| Estimated lines refactorable (Priority 3) | ~375 |
| Overall risk assessment | **LOW-MEDIUM** |

### Recommended Consolidation Locations

| Content | Target Location |
|---------|----------------|
| Shared UI components (`Icon`) | `src/components/shared/Icon.tsx` |
| Shared constants (`TIER_COLORS`) | `src/constants/tierColors.ts` |
| Shared formatting utilities | `src/utils/formatters.ts` (extend existing) |
| Shared color utilities | `src/utils/colors.ts` (new) |
| Shared odds parsing | `src/utils/formatters.ts` (extend existing) |
| Centralized betting types | `src/types/betting.ts` (new) |
| Centralized CSS tokens | `src/styles/tokens.css` (single source of truth) |

### Quick Wins (Can be done individually, low risk)

1. Create `src/components/shared/Icon.tsx` and replace 9 local copies
2. Move `TIER_COLORS` to shared constant file
3. Move `formatCurrency` to `src/utils/formatters.ts` with precision parameter
4. Move `getEdgeColor` to shared utility
5. Extract identical `RaceData` interface to shared file
6. Fix conflicting `--space-*` CSS variables

---

_End of Duplication Audit Report_
