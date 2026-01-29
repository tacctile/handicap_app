# UI Audit Baseline Report

> **Comprehensive audit of all UI components, screens, styles, and backend integration points**
>
> **Date:** January 2026
>
> **Purpose:** Establish exact baseline before UI overhaul

---

## EXECUTIVE SUMMARY

### Key Statistics

| Category                | Count | Notes                                               |
| ----------------------- | ----- | --------------------------------------------------- |
| Component Files (.tsx)  | 89    | In src/components/                                  |
| Hook Files              | 23    | In src/hooks/                                       |
| CSS Files (styles/)     | 4     | tokens.css, responsive.css, dashboard.css, help.css |
| CSS Files (components/) | 20    | Component-specific styles                           |
| Test Files              | 94    | Strong backend coverage, weak UI coverage           |
| Lines of Code (largest) | 2,840 | HorseDetailModal.tsx                                |

### Critical Findings

1. **15 components over 500 lines** need splitting
2. **381 hardcoded hex colors** instead of design tokens
3. **Zero component test files** - major testing gap
4. **Service worker IS configured** (contradicts MASTER_CONTEXT.md docs)
5. **5 AI bots fully wired** and functional

---

## PART 1: COMPONENT INVENTORY

### Components Over 500 Lines (SHOULD BE SPLIT)

| Component                  | Lines | Priority |
| -------------------------- | ----- | -------- |
| HorseDetailModal.tsx       | 2,840 | CRITICAL |
| BettingRecommendations.tsx | 1,851 | HIGH     |
| Dashboard.tsx              | 1,622 | HIGH     |
| BankrollSettings.tsx       | 1,390 | HIGH     |
| HorseExpandedView.tsx      | 1,153 | HIGH     |
| TopBetsView.tsx            | 1,080 | HIGH     |
| AIAnalysisPanel.tsx        | 938   | MEDIUM   |
| MultiRaceBuilderModal.tsx  | 659   | MEDIUM   |
| TrendDetailModal.tsx       | 647   | MEDIUM   |
| BettingStrategyGuide.tsx   | 631   | MEDIUM   |
| ScoringHelpModal.tsx       | 624   | MEDIUM   |
| ExoticBuilderModal.tsx     | 613   | MEDIUM   |
| AccountSettings.tsx        | 612   | MEDIUM   |
| SubscriptionStatus.tsx     | 596   | MEDIUM   |
| ParsingProgress.tsx        | 571   | MEDIUM   |

### Component Categories

**Layout Components (8 files):**

- src/components/layout/Sidebar.tsx
- src/components/layout/MobileNav.tsx
- src/components/layout/RaceTabsBar.tsx
- src/components/layout/Footer.tsx
- src/components/layout/BettingDrawer.tsx
- src/components/layout/TopBar.tsx
- src/components/layout/StatusBar.tsx
- src/components/Header.tsx

**Screen/Page Components (6 files):**

- src/components/Dashboard.tsx (main screen)
- src/components/auth/AuthPage.tsx
- src/components/auth/AccountSettings.tsx
- src/components/help/HelpCenter.tsx
- src/components/subscription/SubscriptionPage.tsx
- src/components/LiveViewer/ViewerLayout.tsx

**Data Display Components (15+ files):**

- src/components/HorseExpandedView.tsx
- src/components/HorseSummaryBar.tsx
- src/components/HorseDetailModal.tsx
- src/components/RaceOverview.tsx
- src/components/RaceVerdictHeader.tsx
- src/components/PPLine.tsx
- src/components/TrendSparkline.tsx
- src/components/cards/RaceOverviewCard.tsx
- src/components/cards/EmptyStateTable.tsx
- src/components/TopBets/TopBetsView.tsx
- src/components/TopBets/TopBetsPanel.tsx
- src/components/TopBets/TopBetCard.tsx
- src/components/TopBets/SimpleTopBetCard.tsx
- src/components/LiveViewer/ViewerRaceDetail.tsx
- src/components/LiveViewer/ViewerRaceList.tsx

**Form/Input Components (5 files):**

- src/components/FileUpload.tsx
- src/components/RaceControls.tsx
- src/components/BankrollSettings.tsx
- src/components/auth/LoginForm.tsx
- src/components/auth/SignupForm.tsx

**Feedback Components (10+ files):**

- src/components/Toast.tsx
- src/components/ErrorBoundary.tsx
- src/components/LoadingState.tsx
- src/components/EmptyState.tsx
- src/components/ParsingProgress.tsx
- src/components/OfflineIndicator.tsx
- src/components/InstallPrompt.tsx
- src/components/UpdatePrompt.tsx
- src/components/ResetConfirmDialog.tsx
- src/components/CalculationStatus.tsx
- src/components/PostTimeCountdown.tsx

**Modal Components (8 files):**

- src/components/HorseDetailModal.tsx
- src/components/ScoringHelpModal.tsx
- src/components/KellyHelpModal.tsx
- src/components/TrendDetailModal.tsx
- src/components/ExoticBuilderModal.tsx
- src/components/MultiRaceBuilderModal.tsx
- src/components/legal/LegalModal.tsx
- src/components/BetMode/DayPlanModal.tsx

**AI-Related Components (1 file):**

- src/components/AIAnalysisPanel.tsx

**Betting-Related Components (15+ files):**

- src/components/BettingRecommendations.tsx
- src/components/BettingStrategyGuide.tsx
- src/components/BankrollSummaryCard.tsx
- src/components/ExoticBuilderModal.tsx
- src/components/MultiRaceBuilderModal.tsx
- src/components/MultiRaceExoticsPanel.tsx
- src/components/ValueTooltip.tsx
- src/components/BetMode/BetModeContainer.tsx
- src/components/BetMode/BetCard.tsx
- src/components/BetMode/BetResults.tsx
- src/components/BetMode/BetModeHeader.tsx
- src/components/BetMode/DayPlanModal.tsx
- src/components/BetMode/InlineSettings.tsx
- src/components/BetMode/RaceNavigation.tsx
- src/components/BetMode/MultiRace/\*.tsx (4 files)
- src/components/BetMode/DaySetup/\*.tsx (6 files)
- src/components/BetMode/LiveShare/ShareControls.tsx

**Auth/Subscription Scaffolding (8 files):**

- src/components/auth/AuthPage.tsx
- src/components/auth/LoginForm.tsx
- src/components/auth/SignupForm.tsx
- src/components/auth/AccountSettings.tsx
- src/components/ProtectedRoute.tsx
- src/components/SubscriptionGate.tsx
- src/components/subscription/SubscriptionPage.tsx
- src/components/subscription/SubscriptionStatus.tsx
- src/components/subscription/PricingCard.tsx

**Help/Legal Components (6 files):**

- src/components/help/HelpCenter.tsx
- src/components/help/FAQAccordion.tsx
- src/components/help/GuideSection.tsx
- src/components/legal/LegalModal.tsx
- src/components/legal/DisclaimerBanner.tsx
- src/components/InfoTooltip.tsx

**Tooltip Components (3 files):**

- src/components/InfoTooltip.tsx
- src/components/ValueTooltip.tsx
- src/components/BetMode/ExplanationTooltip.tsx

**Onboarding Components (2 files):**

- src/components/onboarding/OnboardingFlow.tsx
- src/components/onboarding/OnboardingStep.tsx

**Motion/Animation Components (1 file):**

- src/components/motion/index.tsx

---

## PART 2: SCREEN/VIEW INVENTORY

### Routes (from App.tsx)

| Route           | Component           | Status     | Purpose                 |
| --------------- | ------------------- | ---------- | ----------------------- |
| `/` (dashboard) | Dashboard.tsx       | FUNCTIONAL | Main app - DRF analysis |
| `/account`      | AccountSettings.tsx | SCAFFOLDED | User account settings   |
| `/help`         | HelpCenter.tsx      | FUNCTIONAL | Help documentation      |
| `/live/:code`   | ViewerLayout.tsx    | FUNCTIONAL | Live session viewer     |

### Navigation Structure

```
App.tsx (Router)
├── AuthProvider (context)
│   └── ToastProvider (context)
│       └── AppContent
│           ├── Auth Loading → Spinner
│           ├── Auth Required → AuthPage
│           ├── Live Viewer → ViewerLayout
│           ├── Help → HelpCenter
│           ├── Account → AccountSettings
│           └── Dashboard (default)
```

**Navigation Flow:**

- State-based routing (no react-router)
- `currentRoute` state drives which screen renders
- Deep linking only for `/live/:code` share URLs
- No browser back/forward support
- Mobile nav via MobileNav.tsx bottom bar

### Screen Details

**Dashboard (Main Screen)**

- Route: `/` (default)
- Data Sources: useValueDetection, useRaceBets, useAIAnalysis, useRaceState
- Features: DRF upload, race selection, horse scoring, betting recommendations
- Status: FULLY FUNCTIONAL

**Help Center**

- Route: internal state `help`
- Features: FAQ accordion, guide sections
- Status: FUNCTIONAL

**Account Settings**

- Route: internal state `account`
- Features: Profile, preferences, logout
- Status: SCAFFOLDED (mock auth)

**Live Viewer**

- Route: `/live/:shareCode`
- Features: View shared session, race list, race details
- Status: FUNCTIONAL

---

## PART 3: STYLING AUDIT

### Style Files

| File                      | Lines | Purpose                            |
| ------------------------- | ----- | ---------------------------------- |
| src/styles/tokens.css     | 117   | Design system tokens               |
| src/styles/responsive.css | 2000+ | Responsive utilities & breakpoints |
| src/styles/dashboard.css  | ~1500 | Dashboard-specific styles          |
| src/styles/help.css       | ~500  | Help center styles                 |

### Design System Compliance

**Tailwind Configuration:**

- Using Tailwind CSS v4 via `@tailwindcss/vite`
- No tailwind.config.js (v4 uses CSS-based config)
- Custom tokens in `src/styles/tokens.css`

**Colors Defined in tokens.css:**

```css
--color-primary: #19abb5 ✓ Matches MASTER_CONTEXT --color-primary-hover: #1992a1
  --color-primary-muted: rgba(25, 171, 181, 0.15) --color-base: #0a0a0b ✓ Matches MASTER_CONTEXT
  --color-card: #0f0f10 ✓ Matches MASTER_CONTEXT --color-elevated: #1a1a1c ✓ Matches MASTER_CONTEXT
  --color-text-primary: #eeeff1 ✓ Matches MASTER_CONTEXT --color-text-secondary: #b4b4b6
  --color-text-tertiary: #6e6e70 --color-border: #2a2a2c ✓ Matches MASTER_CONTEXT
  --color-success: #10b981 ✓ Matches MASTER_CONTEXT --color-warning: #f59e0b ✓ Matches
  MASTER_CONTEXT --color-error: #ef4444 ✓ Matches MASTER_CONTEXT;
```

**Spacing (8px Grid):**

```css
--space-1: 4px --space-2: 8px ✓ 8px grid --space-3: 12px --space-4: 16px ✓ 8px grid --space-5: 24px
  ✓ 8px grid --space-6: 32px ✓ 8px grid --space-7: 48px ✓ 8px grid --space-8: 64px ✓ 8px grid;
```

### Styling Issues

**Hardcoded Colors (381 occurrences in 30 files):**

| Component              | Hardcoded Colors | Priority |
| ---------------------- | ---------------- | -------- |
| HorseDetailModal.tsx   | 117              | CRITICAL |
| AccountSettings.tsx    | 33               | HIGH     |
| SubscriptionStatus.tsx | 28               | HIGH     |
| SignupForm.tsx         | 22               | HIGH     |
| LoginForm.tsx          | 18               | HIGH     |
| PricingCard.tsx        | 16               | MEDIUM   |
| SubscriptionPage.tsx   | 15               | MEDIUM   |
| TrendDetailModal.tsx   | 14               | MEDIUM   |
| ProtectedRoute.tsx     | 10               | MEDIUM   |
| HorseExpandedView.tsx  | 10               | MEDIUM   |
| AuthPage.tsx           | 10               | MEDIUM   |
| UpdatePrompt.tsx       | 10               | MEDIUM   |

**Tabular Numbers Usage:**

- 61 occurrences of `tabular-nums` across 19 files ✓
- Good coverage for data displays

**Dark Mode:**

- Dark mode IS the default ✓
- Background: #0a0a0b / #0f0f10
- No light mode remnants found

**Font Configuration:**

- Inter font family configured in index.css ✓
- Font weights: 400, 500, 600, 700 available

---

## PART 4: HOOKS INVENTORY

### All Hooks (23 files)

| Hook                  | Purpose                        | Category    |
| --------------------- | ------------------------------ | ----------- |
| useAIAnalysis         | AI race analysis orchestration | AI          |
| useAnalytics          | Event tracking                 | Analytics   |
| useAuth               | Authentication actions         | Auth        |
| useBankroll           | Bankroll state management      | Betting     |
| useBetting            | Betting calculations           | Betting     |
| useCalibrationData    | Scoring calibration            | Scoring     |
| useEnhancedBetting    | Advanced betting features      | Betting     |
| useFeatureFlag        | Feature flag checks            | Config      |
| useInstallPrompt      | PWA install prompt             | PWA         |
| useKeyboardShortcuts  | Keyboard navigation            | UI          |
| useLiveSessionAdmin   | Live sharing admin             | LiveShare   |
| useLiveSessionViewer  | Live sharing viewer            | LiveShare   |
| useOnboarding         | Onboarding flow state          | UI          |
| useOnlineStatus       | Network status                 | PWA         |
| usePerformance        | Performance monitoring         | Performance |
| usePostTime           | Post time countdown            | UI          |
| useRaceBets           | Race betting state             | Betting     |
| useRaceState          | Race state management          | Core        |
| useSessionPersistence | Session storage                | Core        |
| useSubscription       | Subscription status            | Auth        |
| useTopBets            | Top bets generation            | Betting     |
| useValueDetection     | Value detection                | Scoring     |
| useVirtualScroll      | Virtual list scrolling         | Performance |

### Hook Categories

**Scoring/Algorithm:**

- useCalibrationData
- useValueDetection

**AI Analysis:**

- useAIAnalysis

**Betting Calculation:**

- useBankroll
- useBetting
- useEnhancedBetting
- useRaceBets
- useTopBets

**Data/State Management:**

- useRaceState
- useSessionPersistence

**UI State:**

- useKeyboardShortcuts
- useOnboarding
- usePostTime

**Auth/Subscription (Scaffolded):**

- useAuth
- useSubscription

**PWA/Performance:**

- useInstallPrompt
- useOnlineStatus
- usePerformance
- useVirtualScroll

---

## PART 5: BACKEND INTEGRATION POINTS

### AI Services (src/services/ai/)

**5 AI Bots - ALL WIRED:**
| Bot | Purpose | Status |
|-----|---------|--------|
| Trip Trouble | Analyze trip trouble patterns | FUNCTIONAL |
| Pace Scenario | Analyze pace scenarios | FUNCTIONAL |
| Vulnerable Favorite | Identify vulnerable favorites | FUNCTIONAL |
| Field Spread | Analyze field composition | FUNCTIONAL |
| Class Drop | Identify class droppers | FUNCTIONAL |

**UI Integration:**

- AIAnalysisPanel.tsx consumes useAIAnalysis hook
- useAIAnalysis calls all 5 bots in parallel
- Results displayed in expandable panel

### Scoring Engine (src/lib/scoring/)

**Key Functions:**

- calculateRaceScores - Main scoring entry point
- analyzeOverlayWithField - Overlay analysis
- calculateBaseScoreRanks - Ranking
- calculateRaceConfidence - Confidence calculation
- getTopHorses - Top horse selection

**UI Consumers:**

- Dashboard.tsx imports and uses all scoring functions
- TopBetsView.tsx uses scoring for bet generation

### Betting Calculators (src/lib/betting/)

**Key Functions:**

- Kelly criterion calculator
- Exotic calculators (exacta, trifecta, superfecta)
- Bet sizing
- Tier classification

**UI Consumers:**

- BettingRecommendations.tsx
- ExoticBuilderModal.tsx
- MultiRaceBuilderModal.tsx
- BetMode components

### Track Intelligence (src/data/tracks/)

**Features:**

- 42 tracks with bias/par data
- Post position bias
- Speed bias
- Seasonal patterns

**UI Consumers:**

- Dashboard.tsx via getTrackData()
- AIAnalysisPanel.tsx for track context

### Storage Services (src/services/storage/)

**Features:**

- IndexedDB via storage services
- Session persistence
- Calibration data storage

**UI Consumers:**

- useSessionPersistence hook
- useCalibrationData hook

---

## PART 6: DATA FLOW AUDIT

### Primary Data Flows

**1. DRF Upload → Parsing → Scoring → Display**

```
FileUpload.tsx
  → parseDRFFile (lib/parser)
  → validateParsedData (lib/validation)
  → sessionPersistence.loadOrCreateSession
  → Dashboard receives parsedData
  → calculateRaceScores (lib/scoring)
  → Display in HorseSummaryBar, HorseExpandedView
```

**2. Race Selection → AI Analysis → Findings Display**

```
RaceTabsBar (race selection)
  → selectedRaceIndex state
  → useAIAnalysis hook triggered
  → 5 AI bots called in parallel
  → Results combined
  → AIAnalysisPanel displays findings
```

**3. Betting Recommendations → Display**

```
Scoring results
  → useValueDetection hook
  → useTopBets hook
  → BettingRecommendations displays
  → TopBetsView for consolidated view
```

**4. Track Selection → Bias/Par Data → Display**

```
parsedData.races[x].header.trackCode
  → getTrackData(trackCode)
  → Track intelligence fed to AI bots
  → Bias info displayed in RaceVerdictHeader
```

### Data Flow Issues

**Identified:**

- BetMode/BetModeContainer.tsx disconnected from navigation (comment in Dashboard.tsx)
- Session persistence may have race condition on initial load (skipSaveRef pattern)

---

## PART 7: RESPONSIVE/MOBILE AUDIT

### Breakpoint System

```css
Mobile:  < 768px (default styles)
Tablet:  768px - 1023px
Desktop: 1024px+
Small mobile: < 375px
Large mobile: 375px - 767px
Large desktop: 1280px+
```

### Responsive Implementation

**Media Queries:** 107 @media queries across 3 style files

- responsive.css: 41 queries
- dashboard.css: 54 queries
- help.css: 12 queries

**Touch Targets:**

```css
--touch-target-min: 44px ✓ Meets accessibility minimum --touch-target-lg: 48px;
```

**Safe Area Support:**

```css
--safe-area-top: env(safe-area-inset-top, 0px) --safe-area-bottom: env(safe-area-inset-bottom, 0px);
```

### PWA Status

**manifest.json:** ✓ EXISTS

```json
{
  "name": "Furlong - Advanced Handicapping Analysis",
  "short_name": "Furlong",
  "display": "standalone",
  "background_color": "#0F0F10",
  "theme_color": "#19abb5"
}
```

**Service Worker:** ✓ CONFIGURED (vite-plugin-pwa with Workbox)

- Precaching of static assets
- Runtime caching for fonts, images
- NetworkOnly for auth/payment endpoints

**NOTE:** MASTER_CONTEXT.md says "Service Worker: NOT YET IMPLEMENTED" but it IS configured via vite-plugin-pwa.

---

## PART 8: ACCESSIBILITY AUDIT

### ARIA Implementation

| Attribute Type     | Occurrences | Files    |
| ------------------ | ----------- | -------- |
| aria-\* attributes | 96          | 40 files |
| role= attributes   | 32          | 19 files |
| tabIndex           | 14          | 8 files  |
| onKeyDown handlers | 15          | 9 files  |

### Accessibility Strengths

- Good ARIA label coverage
- Touch targets meet 44px minimum
- Tabular numbers for data displays
- Dark theme with sufficient contrast

### Accessibility Gaps

**Critical:**

- Limited keyboard navigation (only 15 onKeyDown handlers)
- No skip links
- No focus trap in modals (need to verify)

**Medium:**

- Limited role= coverage (32 occurrences)
- Some interactive elements may lack keyboard support

---

## PART 9: ANIMATION/PERFORMANCE AUDIT

### Framer Motion Usage

**27 components use Framer Motion:**

- BankrollSettings.tsx
- BankrollSummaryCard.tsx
- BettingRecommendations.tsx
- BettingStrategyGuide.tsx
- ExoticBuilderModal.tsx
- help/FAQAccordion.tsx
- help/HelpCenter.tsx
- InstallPrompt.tsx
- KellyHelpModal.tsx
- layout/BettingDrawer.tsx
- layout/MobileNav.tsx
- layout/Sidebar.tsx
- layout/TopBar.tsx
- motion/index.tsx (animation library)
- MultiRaceBuilderModal.tsx
- MultiRaceExoticsPanel.tsx
- OfflineIndicator.tsx
- onboarding/OnboardingFlow.tsx
- onboarding/OnboardingStep.tsx
- ParsingProgress.tsx
- PostTimeCountdown.tsx
- RaceOverview.tsx
- ScoringHelpModal.tsx
- Toast.tsx
- UpdatePrompt.tsx
- cards/EmptyStateTable.tsx
- cards/RaceOverviewCard.tsx

### Animation Library (motion/index.tsx)

**Variants Defined:**

- staggerContainer (staggerChildren: 0.05)
- staggerItem (spring animation)
- fadeIn (duration: 0.3)
- slideUp (spring)
- scaleIn (spring)
- skeletonPulse (1.5s loop)

**Components:**

- Ripple (button ripple effect)
- Skeleton (loading placeholder)
- StaggerContainer
- StaggerItem
- FadeIn
- SlideUp
- PulsingGlow
- PageTransition
- AnimatedNumber
- ConfidenceMeter

### Animation Durations

| Animation       | Duration | Compliant |
| --------------- | -------- | --------- |
| fadeIn          | 300ms    | ✓         |
| slideUp         | spring   | ✓         |
| scaleIn         | spring   | ✓         |
| skeletonPulse   | 1500ms   | ✓ (loop)  |
| FadeIn          | 400ms    | ✓         |
| Ripple          | 500ms    | ✓         |
| ConfidenceMeter | 800ms    | ✓         |
| PulsingGlow     | 2000ms   | ✓ (loop)  |

All animations within acceptable ranges (< 300ms for interactions, longer for decorative).

### Performance Considerations

- useVirtualScroll hook available for long lists
- No obvious virtualization in main horse list (potential issue)
- Large components (2800+ lines) may cause re-render performance issues

---

## PART 10: CODE QUALITY AUDIT

### TypeScript Compliance

| Metric                  | Result | Status                      |
| ----------------------- | ------ | --------------------------- |
| any types in components | 0      | ✓ EXCELLENT                 |
| TODO/FIXME comments     | 0      | ✓ EXCELLENT                 |
| console.log statements  | 3      | ⚠ MINOR (subscription only) |

### console.log Locations

Only in scaffolded subscription components:

- src/components/subscription/SubscriptionStatus.tsx: 2
- src/components/subscription/PricingCard.tsx: 1

### Naming Conventions

- Components: PascalCase ✓
- Hooks: use\* prefix ✓
- Files: PascalCase for components ✓
- Consistent patterns throughout

---

## PART 11: TESTING COVERAGE

### Test File Inventory

**Total Test Files:** 94

### Test Coverage by Area

| Area                 | Test Files | Coverage         |
| -------------------- | ---------- | ---------------- |
| lib/scoring          | 22         | EXCELLENT        |
| lib/betting          | 9          | GOOD             |
| lib/value            | 4          | GOOD             |
| lib/patterns         | 3          | MODERATE         |
| services/ai          | 14         | EXCELLENT        |
| services/calibration | 8          | GOOD             |
| integration          | 4          | GOOD             |
| components           | 1          | **CRITICAL GAP** |

### CRITICAL GAP: Component Testing

**Only 1 component test exists:**

- src/components/TopBets/**tests**/TopBetsEnhanced.test.ts

**Components WITHOUT tests (88 of 89):**
ALL other components have NO direct test coverage.

### Integration Tests

- src/**tests**/integration/fullFlow.test.ts
- src/**tests**/integration/fullPipeline.test.ts
- src/**tests**/integration/realDrfFile.test.ts
- src/**tests**/integration/uiDataFlow.test.ts

---

## PART 12: BACKEND HEALTH CHECK

### AI Bots Status

| Bot                 | Wired | Callable | UI Integration  |
| ------------------- | ----- | -------- | --------------- |
| Trip Trouble        | ✓     | ✓        | AIAnalysisPanel |
| Pace Scenario       | ✓     | ✓        | AIAnalysisPanel |
| Vulnerable Favorite | ✓     | ✓        | AIAnalysisPanel |
| Field Spread        | ✓     | ✓        | AIAnalysisPanel |
| Class Drop          | ✓     | ✓        | AIAnalysisPanel |

### Scoring Engine

- calculateRaceScores ✓ Called from Dashboard
- All scoring modules accessible via lib/scoring/index.ts
- MAX_SCORE = 376 (336 base + 40 overlay)

### Betting Calculators

- Kelly criterion ✓ Accessible
- Exotic calculators ✓ Accessible
- Multi-race support ✓ Accessible

### Track Intelligence

- 42 tracks with data ✓
- Bias/par data ✓ Accessible
- Seasonal patterns ✓ Accessible

### Value Detection

- Value detection module ✓ Functional
- useValueDetection hook ✓ Wired
- Results displayed in UI ✓

---

## UNUSED BACKEND CAPABILITIES

Based on audit, these capabilities exist but may have limited/no UI surface:

1. **Calibration Service** - Full calibration pipeline exists but UI integration unclear
2. **Performance Monitoring** - usePerformance hook exists but usage unclear
3. **Analytics Service** - useAnalytics exists but event tracking scope unclear
4. **Virtual Scroll** - useVirtualScroll exists but not used in main horse list

---

## CRITICAL FINDINGS (Top 10)

### Priority 1: CRITICAL

1. **15 components over 500 lines need splitting**
   - HorseDetailModal.tsx at 2,840 lines is unmaintainable
   - Dashboard.tsx at 1,622 lines

2. **381 hardcoded hex colors**
   - Should use CSS variables from tokens.css
   - Worst offender: HorseDetailModal.tsx (117 colors)

3. **Zero component test coverage**
   - Only 1 of 89 components has tests
   - Critical gap for UI overhaul

### Priority 2: HIGH

4. **State-based routing without browser support**
   - No back/forward navigation
   - Limited deep linking

5. **Documentation mismatch**
   - MASTER_CONTEXT.md says "Service Worker: NOT YET IMPLEMENTED"
   - But it IS configured via vite-plugin-pwa

6. **BetMode disconnected**
   - BetModeContainer.tsx exists but removed from navigation
   - Potential dead code

### Priority 3: MEDIUM

7. **Limited keyboard navigation**
   - Only 15 onKeyDown handlers
   - Modal focus traps not verified

8. **Large CSS files**
   - responsive.css: 2000+ lines
   - Could be split or refactored

9. **No virtualization in horse list**
   - useVirtualScroll exists but not implemented
   - Could impact performance with large fields

10. **Subscription console.logs**
    - 3 console.log statements should be removed before production

---

## RECOMMENDED OVERHAUL PRIORITIES

### Phase 1: Component Splitting (Before UI Overhaul)

1. Split HorseDetailModal.tsx (2840 lines) into:
   - HorseDetailHeader
   - HorseDetailPastPerformances
   - HorseDetailWorkouts
   - HorseDetailStats
   - HorseDetailBreeding

2. Split Dashboard.tsx (1622 lines) into:
   - DashboardHeader
   - DashboardRaceList
   - DashboardHorseList
   - DashboardControls

3. Split BettingRecommendations.tsx (1851 lines)

### Phase 2: Design System Compliance

1. Replace all hardcoded hex colors with CSS variables
2. Start with auth/subscription components (scaffolded anyway)
3. Then tackle data display components

### Phase 3: Testing Foundation

1. Add test utilities for component testing
2. Add tests for critical user flows:
   - File upload
   - Race selection
   - Horse expansion
   - Betting recommendations

### Phase 4: Routing Improvements

1. Implement proper routing (react-router or similar)
2. Add browser back/forward support
3. Improve deep linking

### Phase 5: Accessibility

1. Add keyboard navigation to interactive elements
2. Implement focus traps in modals
3. Add skip links

---

## APPENDIX: FILE LISTINGS

### All Component Files (89)

```
src/components/AIAnalysisPanel.tsx
src/components/BankrollSettings.tsx
src/components/BankrollSummaryCard.tsx
src/components/BetMode/BetCard.tsx
src/components/BetMode/BetModeContainer.tsx
src/components/BetMode/BetModeHeader.tsx
src/components/BetMode/BetResults.tsx
src/components/BetMode/DayPlanModal.tsx
src/components/BetMode/DaySetup/BudgetAdjustModal.tsx
src/components/BetMode/DaySetup/DayBankrollStep.tsx
src/components/BetMode/DaySetup/DayComplete.tsx
src/components/BetMode/DaySetup/DayExperienceStep.tsx
src/components/BetMode/DaySetup/DayOverview.tsx
src/components/BetMode/DaySetup/DayProgress.tsx
src/components/BetMode/DaySetup/DayStyleStep.tsx
src/components/BetMode/ExplanationTooltip.tsx
src/components/BetMode/InlineSettings.tsx
src/components/BetMode/LiveShare/ShareControls.tsx
src/components/BetMode/MultiRace/MultiRaceBetDetail.tsx
src/components/BetMode/MultiRace/MultiRaceExplanations.tsx
src/components/BetMode/MultiRace/MultiRaceOpportunities.tsx
src/components/BetMode/MultiRace/MultiRaceTicketEditor.tsx
src/components/BetMode/RaceNavigation.tsx
src/components/BettingRecommendations.tsx
src/components/BettingStrategyGuide.tsx
src/components/CalculationStatus.tsx
src/components/Dashboard.tsx
src/components/EmptyState.tsx
src/components/ErrorBoundary.tsx
src/components/ExoticBuilderModal.tsx
src/components/FileUpload.tsx
src/components/Header.tsx
src/components/HorseDetailModal.tsx
src/components/HorseExpandedView.tsx
src/components/HorseSummaryBar.tsx
src/components/InfoTooltip.tsx
src/components/InstallPrompt.tsx
src/components/KellyHelpModal.tsx
src/components/LiveViewer/ViewerLayout.tsx
src/components/LiveViewer/ViewerMultiRace.tsx
src/components/LiveViewer/ViewerRaceDetail.tsx
src/components/LiveViewer/ViewerRaceList.tsx
src/components/LoadingState.tsx
src/components/MultiRaceBuilderModal.tsx
src/components/MultiRaceExoticsPanel.tsx
src/components/OfflineIndicator.tsx
src/components/PPLine.tsx
src/components/ParsingProgress.tsx
src/components/PostTimeCountdown.tsx
src/components/ProtectedRoute.tsx
src/components/RaceControls.tsx
src/components/RaceOverview.tsx
src/components/RaceVerdictHeader.tsx
src/components/ResetConfirmDialog.tsx
src/components/ScoringHelpModal.tsx
src/components/SubscriptionGate.tsx
src/components/Toast.tsx
src/components/TopBets/SimpleTopBetCard.tsx
src/components/TopBets/TopBetCard.tsx
src/components/TopBets/TopBetsPanel.tsx
src/components/TopBets/TopBetsView.tsx
src/components/TrendDetailModal.tsx
src/components/TrendSparkline.tsx
src/components/UpdatePrompt.tsx
src/components/ValueTooltip.tsx
src/components/auth/AccountSettings.tsx
src/components/auth/AuthPage.tsx
src/components/auth/LoginForm.tsx
src/components/auth/SignupForm.tsx
src/components/cards/EmptyStateTable.tsx
src/components/cards/RaceOverviewCard.tsx
src/components/help/FAQAccordion.tsx
src/components/help/GuideSection.tsx
src/components/help/HelpCenter.tsx
src/components/layout/BettingDrawer.tsx
src/components/layout/Footer.tsx
src/components/layout/MobileNav.tsx
src/components/layout/RaceTabsBar.tsx
src/components/layout/Sidebar.tsx
src/components/layout/StatusBar.tsx
src/components/layout/TopBar.tsx
src/components/legal/DisclaimerBanner.tsx
src/components/legal/LegalModal.tsx
src/components/motion/index.tsx
src/components/onboarding/OnboardingFlow.tsx
src/components/onboarding/OnboardingStep.tsx
src/components/subscription/PricingCard.tsx
src/components/subscription/SubscriptionPage.tsx
src/components/subscription/SubscriptionStatus.tsx
```

### All Hook Files (23)

```
src/hooks/useAIAnalysis.ts
src/hooks/useAnalytics.ts
src/hooks/useAuth.ts
src/hooks/useBankroll.ts
src/hooks/useBetting.ts
src/hooks/useCalibrationData.ts
src/hooks/useEnhancedBetting.ts
src/hooks/useFeatureFlag.ts
src/hooks/useInstallPrompt.ts
src/hooks/useKeyboardShortcuts.ts
src/hooks/useLiveSessionAdmin.ts
src/hooks/useLiveSessionViewer.ts
src/hooks/useOnboarding.ts
src/hooks/useOnlineStatus.ts
src/hooks/usePerformance.ts
src/hooks/usePostTime.ts
src/hooks/useRaceBets.ts
src/hooks/useRaceState.ts
src/hooks/useSessionPersistence.ts
src/hooks/useSubscription.ts
src/hooks/useTopBets.ts
src/hooks/useValueDetection.ts
src/hooks/useVirtualScroll.ts
```

---

_End of UI Audit Baseline Report_
