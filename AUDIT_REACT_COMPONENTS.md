# React Component Audit Report — Enterprise Quality Standards

> **Audit Date:** February 5, 2026
>
> **Reference:** MASTER_CONTEXT.md Enterprise Quality Standards
>
> **Scope:** All 75 `.tsx` files in `src/components/` (including subdirectories)
>
> **Mode:** READ-ONLY — no files modified

---

## CRITICAL (must fix before production)

1. **InstallPrompt.tsx:24** — `handleInstall()` is an async function with NO try/catch. If `promptInstall()` rejects, the error is completely unhandled and `isInstalling` state will be stuck as `true`.

2. **Component test coverage at 1.33%** — Only 1 of 75 components has a test file (`TopBets/TopBetsView.tsx`). The remaining 74 components have zero test coverage. MASTER_CONTEXT.md requires "corresponding test file for new modules."

3. **No per-component ErrorBoundary wrapping** — ErrorBoundary exists and is used at the app level in `App.tsx`, but no individual component imports or wraps itself with ErrorBoundary. A single component crash in `HorseDetailModal` (2,840 lines) or `BettingRecommendations` (1,851 lines) takes down the entire view. MASTER_CONTEXT.md template requires "ErrorBoundary wrapper (major components)."

---

## HIGH (should fix soon)

4. **33 exported functions missing explicit return types** — Violates "explicit TypeScript types (no `any`)" standard. Key files:
   - `src/components/onboarding/OnboardingFlow.tsx:20`
   - `src/components/cards/RaceOverviewCard.tsx:88`
   - `src/components/layout/Sidebar.tsx:33`
   - `src/components/layout/TopBar.tsx:25`
   - `src/components/motion/index.tsx` (8 exports without return types)
   - `src/components/Toast.tsx:118` (`useToasts()` hook)
   - `src/components/ParsingProgress.tsx:492` (`useParsingProgress()` hook)

5. **12 components use inline prop types instead of named interfaces** — 9 are repeated `Icon` helper functions with identical `{ name: string; className?: string }` inline types across files:
   - `BettingStrategyGuide.tsx:20`, `CalculationStatus.tsx:13`, `HorseDetailModal.tsx:86`, `ParsingProgress.tsx:75`, `RaceControls.tsx:17`, `ResetConfirmDialog.tsx:15`, `ScoringHelpModal.tsx:18`, `Toast.tsx:25`, `TrendDetailModal.tsx:82`
   - Also: `InstallPrompt.tsx:110`, `UpdatePrompt.tsx:98`

6. **6 components use console.error/console.warn instead of logging service:**
   - `UpdatePrompt.tsx:38` — `console.error('[SW] Registration error:', error)`
   - `TopBetCard.tsx:33` — `console.error('Failed to copy:', error)`
   - `TopBetsPanel.tsx:141` — `console.error('Failed to copy:', error)`
   - `BetModeContainer.tsx:342` — `console.error('Failed to copy:', error)`
   - `BetCard.tsx:35` — `console.error('Failed to copy:', error)`
   - `MultiRaceBetDetail.tsx:53` — `console.warn('Failed to copy:', err)`

   MASTER_CONTEXT.md requires: "Use logging service, not console.log in production"

7. **48 large components (>100 lines) have no try/catch blocks** — Major components with complex logic and zero error handling:
   - `BettingRecommendations.tsx` (1,851 lines)
   - `BankrollSettings.tsx` (1,390 lines)
   - `TopBetsView.tsx` (1,080 lines)
   - `AIAnalysisPanel.tsx` (937 lines)
   - `MultiRaceBuilderModal.tsx` (659 lines)
   - `ExoticBuilderModal.tsx` (613 lines)

8. **Clipboard operations silently fail** — 6 files catch clipboard errors but only log to console with no user-facing feedback. Users get no indication when copy fails.

---

## MEDIUM (technical debt)

9. **60+ hardcoded hex colors outside the design system** — MASTER_CONTEXT.md rule: "Design system only." Worst offenders:
   - `TrendDetailModal.tsx` — 40+ violations (#888, #333, #444, #666, #fff, #e0e0e0, #222, #1a1a1a)
   - `HorseDetailModal.tsx` — 25+ violations (#888, #e0e0e0, chart colors)
   - `MultiRaceBuilderModal.tsx` — #3b82f6, #22c55e, #eab308
   - `BettingRecommendations.tsx` — #3b82f6, #22c55e, #9ca3af
   - `UpdatePrompt.tsx` — #242428, #059669, #fff
   - `InstallPrompt.tsx` — #242428, #fff
   - `Dashboard.tsx` — #555555

10. **234 inline styles (`style={{}}`)** across 25+ files. Top offenders:
    - `HorseDetailModal.tsx` — 40+ inline styles
    - `TrendDetailModal.tsx` — 35+ inline styles
    - `BankrollSettings.tsx` — 15+ inline styles
    - `HorseExpandedView.tsx` — 12+ inline styles

11. **569 non-8px-grid pixel values** — Common violations: 6px, 10px, 12px, 13px, 14px, 20px. Note: 1px/2px/4px borders and typography scale sizes (12px, 14px, 18px, 24px, 32px) are acceptable.

12. **29 files over 200 lines** (candidates for splitting):
    - `HorseDetailModal.tsx` — **2,840 lines**
    - `BettingRecommendations.tsx` — **1,851 lines**
    - `Dashboard.tsx` — **1,594 lines**
    - `BankrollSettings.tsx` — **1,390 lines**
    - `HorseExpandedView.tsx` — 1,153 lines
    - `TopBetsView.tsx` — 1,080 lines

13. **High coupling** — `BettingRecommendations.tsx` has 23 import statements. `BetModeContainer.tsx` has 16.

14. **HorseSummaryBar.tsx:226** — onClick handler on a div without keyboard equivalent (onKeyDown, role="button", tabIndex). Only accessibility keyboard gap found.

---

## LOW (nice to have)

15. **24 components missing JSDoc documentation** — MASTER_CONTEXT.md template requires "JSDoc comment describing purpose." Major undocumented:
    - `HorseDetailModal.tsx`, `BettingRecommendations.tsx`, `Dashboard.tsx`, `BankrollSettings.tsx`, `ErrorBoundary.tsx`, `FileUpload.tsx`

16. **Repeated `Icon` helper pattern** — 9 files independently define an identical `Icon` helper function with inline props. Should be extracted to a shared component.

17. **ARIA implementation is strong** — 32 role attributes, 96 aria-label/labelledby/describedby usages, proper aria-hidden on decorative icons. Only the HorseSummaryBar keyboard gap noted above.

18. **tabular-nums compliance is good** — 14 CSS files properly implement `font-variant-numeric: tabular-nums` for data displays.

---

## METRICS SUMMARY

| Metric | Value |
|--------|-------|
| Total components | 75 |
| Components with tests | 1 (1.33%) |
| Components with ErrorBoundary | 0 individual (1 app-level) |
| `any` type usages | 0 |
| Missing return types | 33 |
| Inline prop types (no interface) | 12 |
| console.log statements | 0 |
| console.warn statements | 1 |
| console.error statements | 5 |
| Components using logger service | 8 |
| Hardcoded colors outside design system | 60+ |
| Inline styles (style={{}}) | 234 |
| Non-8px-grid px values | 569 |
| Components over 200 lines | 29 |
| Components over 1000 lines | 6 |
| Components missing JSDoc | 24 |
| High-coupling components (10+ imports) | 5+ |
| Accessibility keyboard gaps | 1 |

---

## TOP 10 FILES NEEDING ATTENTION

| Rank | File | Lines | Issues |
|------|------|-------|--------|
| 1 | `src/components/HorseDetailModal.tsx` | 2,840 | No ErrorBoundary, no tests, 25+ non-compliant colors, 40+ inline styles, missing JSDoc, inline props |
| 2 | `src/components/TrendDetailModal.tsx` | 647 | No ErrorBoundary, no tests, 40+ non-compliant colors, 35+ inline styles, inline props |
| 3 | `src/components/BettingRecommendations.tsx` | 1,851 | No ErrorBoundary, no tests, no try/catch, 23 imports, non-compliant colors, missing JSDoc |
| 4 | `src/components/BankrollSettings.tsx` | 1,390 | No ErrorBoundary, no tests, no try/catch, 15+ inline styles, missing JSDoc |
| 5 | `src/components/Dashboard.tsx` | 1,594 | No ErrorBoundary, no tests, non-compliant colors, missing JSDoc |
| 6 | `src/components/TopBets/TopBetsView.tsx` | 1,080 | No ErrorBoundary, no try/catch, missing JSDoc |
| 7 | `src/components/InstallPrompt.tsx` | 364 | **Unhandled async** (critical), no tests, non-compliant colors, inline props |
| 8 | `src/components/MultiRaceBuilderModal.tsx` | 659 | No ErrorBoundary, no tests, no try/catch, non-compliant colors |
| 9 | `src/components/HorseExpandedView.tsx` | 1,153 | No ErrorBoundary, no tests, 12+ inline styles |
| 10 | `src/components/UpdatePrompt.tsx` | 345 | No tests, console.error instead of logger, non-compliant colors, inline props |

---

## DETAILED FINDINGS BY PART

### Part 1 — TypeScript Type Safety

**`any` type usage: 0 instances** — The codebase has zero explicit `any` types. This is a strength.

**Missing return types (33 instances):**

| # | File | Line | Function |
|---|------|------|----------|
| 1 | cards/EmptyStateTable.tsx | 20 | `export function EmptyStateTable()` |
| 2 | cards/RaceOverviewCard.tsx | 88 | `export function RaceOverviewCard()` |
| 3 | help/FAQAccordion.tsx | 17 | `export function FAQAccordion()` |
| 4 | help/GuideSection.tsx | 14 | `export function GuideSection()` |
| 5 | help/HelpCenter.tsx | 21 | `export function HelpCenter()` |
| 6 | layout/Footer.tsx | 16 | `export function Footer()` |
| 7 | layout/MobileNav.tsx | 16 | `export function MobileNav()` |
| 8 | layout/Sidebar.tsx | 33 | `export function Sidebar()` |
| 9 | layout/TopBar.tsx | 25 | `export function TopBar()` |
| 10 | legal/DisclaimerBanner.tsx | 19 | `export function DisclaimerBanner()` |
| 11 | legal/LegalModal.tsx | 37 | `export function LegalModal()` |
| 12 | motion/index.tsx | 94 | `export function Ripple()` |
| 13 | motion/index.tsx | 119 | `export function Skeleton()` |
| 14 | motion/index.tsx | 138 | `export function StaggerContainer()` |
| 15 | motion/index.tsx | 177 | `export function FadeIn()` |
| 16 | motion/index.tsx | 198 | `export function SlideUp()` |
| 17 | motion/index.tsx | 213 | `export function PulsingGlow()` |
| 18 | motion/index.tsx | 238 | `export function PageTransition()` |
| 19 | motion/index.tsx | 265 | `export function AnimatedNumber()` |
| 20 | motion/index.tsx | 291 | `export function ConfidenceMeter()` |
| 21 | onboarding/OnboardingFlow.tsx | 20 | `export function OnboardingFlow()` |
| 22 | onboarding/OnboardingStep.tsx | 19 | `export function OnboardingStep()` |
| 23 | layout/BettingDrawer.tsx | 11 | `export const BettingDrawer = memo()` |
| 24 | layout/RaceTabsBar.tsx | 43 | `export const RaceTabsBar = memo()` |
| 25 | layout/StatusBar.tsx | 9 | `export const StatusBar = memo()` |
| 26 | Toast.tsx | 118 | `export function useToasts()` |
| 27 | ParsingProgress.tsx | 492 | `export function useParsingProgress()` |
| 28 | ParsingProgress.tsx | 98 | `const ProgressBar = memo()` |
| 29 | ResetConfirmDialog.tsx | 23 | `export const ResetConfirmDialog = memo()` |
| 30 | Toast.tsx | 40 | `export const Toast = memo()` |
| 31 | Toast.tsx | 99 | `export const ToastContainer = memo()` |

### Part 2 — Error Handling

**ErrorBoundary wrapping:** App-level only (App.tsx wraps Dashboard and HelpCenter routes). Zero individual component wrapping.

**Try/catch distribution (14 of 75 files, 19%):**
- Dashboard.tsx — 3 blocks (date/time parsing)
- FileUpload.tsx — 2 blocks (file reading)
- HorseDetailModal.tsx — 1 block (connections score)
- HorseExpandedView.tsx — 2 blocks (workout date parsing)
- PPLine.tsx — 2 blocks (date parsing)
- TopBetsPanel.tsx, TopBetCard.tsx, BetCard.tsx, BetModeContainer.tsx, MultiRaceBetDetail.tsx — 1 block each (clipboard)
- DisclaimerBanner.tsx — 4 blocks (localStorage)

### Part 3 — Console Statements

| Type | Count | Files |
|------|-------|-------|
| console.log | 0 | — |
| console.warn | 1 | MultiRaceBetDetail.tsx:53 |
| console.error | 5 | UpdatePrompt.tsx:38, TopBetCard.tsx:33, TopBetsPanel.tsx:141, BetModeContainer.tsx:342, BetCard.tsx:35 |
| logger.* (proper) | 8 files | ErrorBoundary, FileUpload, HelpCenter, FAQAccordion, Footer, Sidebar, DisclaimerBanner, LegalModal |

### Part 4 — Design System Compliance

**Approved palette:** #19abb5, #1992a1, #1b7583, #36d1da, #0A0A0B, #0F0F10, #1A1A1C, #EEEFF1, #B4B4B6, #6E6E70, #2A2A2C, #3A3A3C, #10b981, #f59e0b, #ef4444

**Non-compliant colors found (60+ unique, 994 total usages):**
- Generic grays: #888, #333, #444, #555, #666, #e0e0e0, #222, #1a1a1a, #111, #1e1e1e
- Pure white: #fff
- Tailwind defaults: #3b82f6, #22c55e, #eab308, #9ca3af, #6b7280, #f97316, #60a5fa, #a855f7, #8b5cf6
- Off-brand accents: #242428, #059669, #4ade80, #16a34a, #06b6d4, #0891b2

### Part 5 — Test Coverage

- **Total component files:** 75
- **Test files found:** 1 (`TopBets/__tests__/TopBetsEnhanced.test.ts`)
- **Coverage:** 1.33%

### Part 6 — Component Structure

**Files over 1000 lines (6):**
- HorseDetailModal.tsx: 2,840
- BettingRecommendations.tsx: 1,851
- Dashboard.tsx: 1,594
- BankrollSettings.tsx: 1,390
- HorseExpandedView.tsx: 1,153
- TopBetsView.tsx: 1,080

**Highest coupling:**
- BettingRecommendations.tsx: 23 imports
- BetModeContainer.tsx: 16 imports

### Part 7 — Accessibility

**Strong overall** — 32 ARIA role attributes, 96 aria-label usages, proper modal accessibility, proper aria-hidden on decorative icons.

**One gap:** HorseSummaryBar.tsx:226 — div with onClick but no keyboard handler, role, or tabIndex.

---

_End of audit report._
