# Handicap App — Technical Specification

> **Definitive technical reference for the Handicap App codebase**
>
> **Last Updated:** January 2026
>
> **Related Documents:**
> - [MASTER_CONTEXT.md](../MASTER_CONTEXT.md) — Project DNA, absolute rules, workflow
> - [ALGORITHM_REFERENCE.md](../ALGORITHM_REFERENCE.md) — Scoring algorithm constants and methodology
> - [UI_AUDIT_BASELINE.md](../UI_AUDIT_BASELINE.md) — Component inventory and UI metrics

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
   - [Data Flow](#data-flow)
   - [Component Hierarchy](#component-hierarchy)
   - [Custom Hooks](#custom-hooks)
   - [Context Providers](#context-providers)
   - [Web Workers](#web-workers)
3. [Service Layer](#service-layer)
   - [AI Service](#ai-service)
   - [Auth Service](#auth-service)
   - [Payments Service](#payments-service)
   - [Storage Service](#storage-service)
   - [Analytics Service](#analytics-service)
4. [Scoring Engine](#scoring-engine)
   - [Pipeline Stages](#pipeline-stages)
   - [Scoring Modules](#scoring-modules)
   - [Overlay System](#overlay-system)
   - [Tier Classification](#tier-classification)
   - [Recalculation Triggers](#recalculation-triggers)
5. [Type System](#type-system)
   - [Core Types](#core-types)
   - [Error Types](#error-types)
   - [API Response Types](#api-response-types)
6. [UI Architecture](#ui-architecture)
   - [Routing Mechanism](#routing-mechanism)
   - [Large Components](#large-components)
   - [Modal System](#modal-system)
   - [Design Tokens](#design-tokens)
7. [Integration Points](#integration-points)
   - [External API Contracts](#external-api-contracts)
   - [PWA Configuration](#pwa-configuration)
   - [Build and Deploy Pipeline](#build-and-deploy-pipeline)
8. [Data Contracts](#data-contracts)
   - [DRF Parser](#drf-parser)
   - [Horse Type](#horse-type)
   - [Race Type](#race-type)
   - [Betting Recommendations](#betting-recommendations)

---

## Overview

The Handicap App is a professional-grade horse racing handicapping progressive web application. It parses Daily Racing Form (DRF) files containing 1,435 fields per horse, applies a deterministic 331-point mathematical scoring algorithm with ±40 overlay adjustment, and outputs tiered betting recommendations.

**Core Architecture Principles:**
- **Deterministic:** Same inputs always produce same outputs
- **Mobile-first:** 375px is the primary design target
- **Offline-capable:** PWA with manifest (service worker scaffolded)
- **Enterprise-ready:** Auth, payments, and AI scaffolded from day one
- **Algorithm immutability:** Users adjust inputs, never the underlying math

**Technology Stack:**
| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build | Vite |
| Styling | TailwindCSS + CSS |
| State | React Context + useReducer |
| Storage | IndexedDB |
| Testing | Vitest + Playwright |
| Hosting | Vercel |
| AI | Google Gemini API |

---

## System Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Upload  │───▶│   Dashboard  │───▶│  Race View   │───▶│  Bet Mode    │  │
│  │  Screen  │    │  (Overview)  │    │  (Details)   │    │  (Planning)  │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │
└───────┬─────────────────┬─────────────────┬─────────────────┬───────────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOOKS LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ useRaceState │  │  useBetting  │  │useValueDetect│  │useAIAnalysis │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────┬─────────────────┬─────────────────┬─────────────────┬───────────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE LIBRARY                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  DRF Parser  │  │Scoring Engine│  │Betting System│  │Track Intellig│    │
│  │ (1,435 flds) │  │ (331 + ±40)  │  │(Kelly sizing)│  │ (42 tracks)  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────┬─────────────────┬─────────────────┬─────────────────┬───────────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │    AI    │  │   Auth   │  │ Payments │  │ Storage  │  │Analytics │      │
│  │ (Gemini) │  │ (Mock)   │  │  (Mock)  │  │(IndexedDB│  │(Logging) │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Data Flow Summary:**
1. User uploads DRF file via upload screen
2. DRF parser extracts 1,435 fields per horse into structured data
3. Scoring engine calculates 331-point base score for each horse
4. Overlay system applies ±40 adjustment based on track conditions
5. Tier classification determines betting recommendations
6. Value detection identifies market inefficiencies
7. AI analysis provides contextual insights (5 bots)
8. Betting system calculates Kelly-criterion position sizes

### Component Hierarchy

```
App
├── AuthProvider (Context)
│   └── ToastProvider (Context)
│       └── AppContent
│           ├── AuthPage (when !authenticated && AUTH_ENABLED)
│           ├── ViewerLayout (when route === 'live-viewer')
│           ├── HelpCenter (when route === 'help')
│           ├── AccountSettings (when route === 'account')
│           └── Dashboard (default route)
│               ├── Header
│               │   ├── Logo
│               │   ├── FileUpload
│               │   └── UserMenu
│               ├── RaceSelector
│               │   ├── RaceCard (per race)
│               │   └── ConfidenceBadge
│               ├── RaceView
│               │   ├── RaceHeader
│               │   ├── HorseTable
│               │   │   └── HorseRow (per horse)
│               │   ├── ScoringBreakdown
│               │   └── AIAnalysisPanel
│               ├── BetMode
│               │   ├── BankrollInput
│               │   ├── TierFilter
│               │   └── BetRecommendations
│               └── ExoticCalculators
│                   ├── ExactaCalculator
│                   ├── TrifectaCalculator
│                   └── MultiRaceCalculator
```

**Major Component Categories (89 total):**
- Dashboard & Layout: 12 components
- Race Display: 18 components
- Scoring & Analysis: 15 components
- Betting & Exotic: 14 components
- Auth & Account: 8 components
- Help & Documentation: 6 components
- Shared/UI Primitives: 16 components

### Custom Hooks

The application uses 23-26 custom hooks in `src/hooks/`:

| Hook | Purpose | Key State |
|------|---------|-----------|
| `useRaceState` | Track condition, scratches, odds, calculation history | `trackCondition`, `scratchedHorses`, `updatedOdds` |
| `useValueDetection` | Identifies market value opportunities | `minOddsForValue: 6`, `minEdgePercent: 50` |
| `useAIAnalysis` | Manages 5-bot AI analysis with caching | `analyses`, `isLoading`, 30-min cache TTL |
| `useBetting` | Kelly-criterion bet sizing | `quarterKelly`, `bankrollTracker` |
| `useBankroll` | Bankroll management with 3 complexity modes | `simple`, `moderate`, `advanced` |
| `useSessionPersistence` | Persists session state to IndexedDB | `session`, `loadOrCreateSession` |
| `useKeyboardShortcuts` | Global keyboard navigation | Modal-aware shortcuts |
| `useAnalytics` | Event tracking | `trackEvent`, session timing |
| `useFeatureFlag` | Feature flag evaluation | `AUTH_ENABLED`, etc. |
| `useAuth` | Authentication hook | `isAuthenticated`, `user` |
| `useSubscription` | Subscription state | `tier`, `isActive` |
| `useToast` | Toast notification triggers | `addToast` |

**Hook Dependencies:**
```
useRaceState
├── useState (React)
├── useCallback (React)
└── useRef (React)

useAIAnalysis
├── useState (React)
├── useCallback (React)
├── useMemo (React)
└── AIService (service layer)

useBetting
├── useRaceState
├── useBankroll
└── BettingCalculator (lib)
```

### Context Providers

**AuthContext** (`src/contexts/AuthContext.tsx`)

Provides authentication state and actions across the application.

```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
```

**Status:** SCAFFOLDED (uses MockAuthService, ready for Supabase/Firebase)

---

**ToastContext** (`src/contexts/ToastContext.tsx`)

Provides toast notification system with post-time notifications support.

```typescript
interface ToastContextType {
  toasts: Toast[];
  addToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' | 'critical',
    options?: ToastOptions
  ) => void;
  removeToast: (id: string) => void;
}

interface ToastOptions {
  duration?: number;
  icon?: string;
}
```

**Status:** IMPLEMENTED

### Web Workers

**DRF Parser Worker**

The DRF parsing is designed to run in a Web Worker to prevent UI blocking during large file processing.

**Status:** SCAFFOLDED — Worker architecture is referenced in the codebase but the actual worker file (`src/workers/drfParser.worker.ts`) was not found during audit. Parsing may currently run on main thread.

**Expected Interface:**
```typescript
// Worker input
interface ParseRequest {
  fileContent: string;
  filename: string;
}

// Worker output
interface ParseResponse {
  success: boolean;
  data?: ParsedDRFFile;
  error?: string;
}
```

---

## Service Layer

### AI Service

**Location:** `src/services/ai/`

**Provider:** Google Gemini API

**Architecture:** 5 specialized analysis bots running in parallel with caching.

| Bot | Purpose | Analysis Focus |
|-----|---------|----------------|
| Trip Trouble | Identifies horses with troubled trips | Traffic problems, wide trips, poor breaks |
| Pace Scenario | Analyzes pace dynamics | Speed figures, running styles, pace matchups |
| Vulnerable Favorite | Spots beatable favorites | Overbet horses, negative patterns |
| Field Spread | Assesses competitive field | Field strength, class levels |
| Class Drop | Identifies class movements | Horses dropping in class |

**Caching Strategy:**
- Cache TTL: 30 minutes
- Cache key: `${raceId}_${botType}`
- Parallel execution for all 5 bots
- Graceful degradation on API failure

**Interface:**
```typescript
interface AIAnalysisResult {
  botType: 'tripTrouble' | 'paceScenario' | 'vulnerableFavorite' | 'fieldSpread' | 'classDrop';
  analysis: string;
  confidence: number;
  timestamp: number;
}

interface AIService {
  analyzeRace(race: ParsedRace, options?: AnalysisOptions): Promise<AIAnalysisResult[]>;
  clearCache(): void;
}
```

**Status:** WIRED AND FUNCTIONAL

### Auth Service

**Location:** `src/services/auth/`

**Current Implementation:** MockAuthService (returns mock data)

**Provider Abstraction:** Ready for Supabase or Firebase

**Interface:**
```typescript
interface AuthService {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  onAuthStateChange(callback: (user: User | null) => void): () => void;
}

interface AuthResult {
  user: User;
  session: Session;
}

interface User {
  id: string;
  email: string;
  createdAt: Date;
}
```

**Status:** SCAFFOLDED

### Payments Service

**Location:** `src/services/payments/`

**Current Implementation:** MockSubscriptionService (returns mock data)

**Provider Abstraction:** Ready for Stripe integration

**Interface:**
```typescript
interface SubscriptionService {
  getSubscription(userId: string): Promise<Subscription | null>;
  createCheckoutSession(priceId: string): Promise<CheckoutSession>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  updateSubscription(subscriptionId: string, newPriceId: string): Promise<Subscription>;
}

interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  tier: 'free' | 'pro' | 'enterprise';
  currentPeriodEnd: Date;
}
```

**Status:** SCAFFOLDED

### Storage Service

**Location:** `src/services/storage/`

**Implementation:** IndexedDB via custom wrapper

**Database Stores:**

| Store | Purpose | Key | Expiration |
|-------|---------|-----|------------|
| `race-data` | Parsed DRF files | filename hash | 7 days |
| `preferences` | User settings | `user_prefs` | Never |
| `calculations` | Cached scoring results | race ID | 24 hours |
| `historical-races` | Past race data for calibration | race ID | 30 days |
| `calibration-meta` | Calibration metadata | `calibration_state` | Never |

**Interface:**
```typescript
interface StorageService {
  get<T>(store: StoreName, key: string): Promise<T | null>;
  set<T>(store: StoreName, key: string, value: T, ttl?: number): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
  getAllKeys(store: StoreName): Promise<string[]>;
}

type StoreName = 'race-data' | 'preferences' | 'calculations' | 'historical-races' | 'calibration-meta';
```

**Status:** IMPLEMENTED

### Analytics Service

**Location:** `src/services/analytics/`

**Implementation:** Logging service with structured events

**Key Events Tracked:**
- `session_start` — User agent, screen size, PWA detection
- `session_end` — Session duration
- `file_upload` — File parsing success/failure
- `race_view` — Race selection
- `bet_placed` — Betting actions (no PII)
- `error` — Application errors

**Interface:**
```typescript
interface AnalyticsService {
  trackEvent(name: string, properties?: Record<string, unknown>): void;
  setUserId(userId: string): void;
  setUserProperties(properties: Record<string, unknown>): void;
}
```

**Status:** IMPLEMENTED (logging only, no external analytics provider)

---

## Scoring Engine

### Pipeline Stages

The scoring engine processes each horse through a sequential pipeline:

```
Input: HorseEntry + RaceContext
         │
         ▼
┌─────────────────────┐
│ 1. Data Validation  │ ─── Validate required fields exist
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 2. Base Scoring     │ ─── Calculate 331-point base score
│    (10 categories)  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 3. Overlay Calc     │ ─── Apply ±40 adjustment
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 4. Total Score      │ ─── Base + Overlay (max 371)
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 5. Tier Assignment  │ ─── Classify into tiers
└─────────────────────┘
         │
         ▼
Output: ScoredHorse
```

### Scoring Modules

**Base Score Categories (331 points maximum):**

| Category | Max Points | Module Location |
|----------|------------|-----------------|
| Speed Figures | 75 | `src/lib/scoring/speed/` |
| Class | 60 | `src/lib/scoring/class/` |
| Form Cycle | 50 | `src/lib/scoring/form/` |
| Pace | 45 | `src/lib/scoring/pace/` |
| Connections | 30 | `src/lib/scoring/connections/` |
| Distance | 25 | `src/lib/scoring/distance/` |
| Surface | 20 | `src/lib/scoring/surface/` |
| Post Position | 10 | `src/lib/scoring/post/` |
| Equipment | 8 | `src/lib/scoring/equipment/` |
| Layoff | 8 | `src/lib/scoring/layoff/` |

**Total Modules:** 50 files in `src/lib/scoring/`

**Master Scoring Entry Point:** `src/lib/scoring/index.ts`

```typescript
// Key constants from scoring engine
const MAX_BASE_SCORE = 331;
const MAX_OVERLAY = 40;
const MAX_TOTAL_SCORE = MAX_BASE_SCORE + MAX_OVERLAY; // 371

// Category limits
const CATEGORY_LIMITS = {
  speed: 75,
  class: 60,
  formCycle: 50,
  pace: 45,
  connections: 30,
  distance: 25,
  surface: 20,
  postPosition: 10,
  equipment: 8,
  layoff: 8,
};
```

### Overlay System

The overlay system adjusts base scores by ±40 points based on value factors.

**Overlay Factors:**

| Factor | Impact | Range |
|--------|--------|-------|
| Morning Line vs Current Odds | Positive when odds drift | +0 to +15 |
| Track Bias Alignment | Bonus for bias match | +0 to +10 |
| Trainer Patterns | Form cycle patterns | ±5 |
| Jockey Hot Streaks | Recent win rate | +0 to +5 |
| Equipment Changes | Blinkers, etc. | ±5 |

**Calculation:**
```typescript
interface OverlayResult {
  adjustment: number;      // -40 to +40
  factors: OverlayFactor[];
  confidence: number;      // 0-1
}

function calculateOverlay(
  horse: HorseEntry,
  currentOdds: number,
  trackBias: TrackBias
): OverlayResult;
```

### Tier Classification

Horses are classified into betting tiers based on total score:

| Tier | Score Range | Betting Recommendation |
|------|-------------|------------------------|
| **Tier 1** | 180-240+ | Strong play — full Kelly |
| **Tier 2** | 160-179 | Moderate play — half Kelly |
| **Tier 3** | 130-159 | Light play — quarter Kelly |
| **No Bet** | <130 | Below threshold — pass |

**Tier Assignment Logic:**
```typescript
function assignTier(totalScore: number): BettingTier {
  if (totalScore >= 180) return 'tier1';
  if (totalScore >= 160) return 'tier2';
  if (totalScore >= 130) return 'tier3';
  return 'noBet';
}
```

### Recalculation Triggers

Scores are recalculated when any of these state changes occur:

| Trigger | Affected Calculations |
|---------|----------------------|
| Track condition change | Surface scores, pace scores, overlay |
| Horse scratched | All horses (affects field dynamics) |
| Odds update | Overlay only |
| Weather change | Surface scores, pace projections |

**Implementation:**
```typescript
// In useRaceState hook
useEffect(() => {
  if (parsedData && (
    trackConditionChanged ||
    scratchesChanged ||
    oddsChanged
  )) {
    recalculateScores();
  }
}, [trackCondition, scratches, odds, parsedData]);
```

---

## Type System

### Core Types

**Location:** `src/types/`

**HorseEntry** — Complete horse data from DRF:
```typescript
interface HorseEntry {
  programNumber: string;
  horseName: string;
  jockey: JockeyInfo;
  trainer: TrainerInfo;
  owner: string;
  morningLineOdds: number;
  weight: number;
  medication: string;
  equipment: string;
  claimingPrice?: number;
  pastPerformances: PastPerformance[];
  workouts: Workout[];
  lifetime: LifetimeRecord;
  currentYear: YearRecord;
  previousYear: YearRecord;
  // ... 1,435 total fields
}
```

**ParsedRace** — Single race with all horses:
```typescript
interface ParsedRace {
  raceNumber: number;
  trackCode: string;
  date: string;
  distance: Distance;
  surface: 'dirt' | 'turf' | 'synthetic';
  raceType: RaceType;
  purse: number;
  conditions: string;
  horses: HorseEntry[];
  postTime?: string;
}
```

**ParsedDRFFile** — Complete file output:
```typescript
interface ParsedDRFFile {
  filename: string;
  trackCode: string;
  raceDate: string;
  races: ParsedRace[];
  parseTimestamp: number;
}
```

**ScoredHorse** — Horse with calculated scores:
```typescript
interface ScoredHorse extends HorseEntry {
  baseScore: number;
  overlayAdjustment: number;
  totalScore: number;
  tier: BettingTier;
  categoryScores: CategoryScores;
  confidence: DataCompleteness;
}
```

### Error Types

**Location:** `src/types/errors.ts`

**Base Error Class:**
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

**Specialized Errors:**

| Error Class | Use Case | Error Code |
|-------------|----------|------------|
| `DRFParseError` | File parsing failures | `DRF_PARSE_ERROR` |
| `ValidationError` | Data validation failures | `VALIDATION_ERROR` |
| `FileFormatError` | Invalid file format | `FILE_FORMAT_ERROR` |
| `NetworkError` | API/network failures | `NETWORK_ERROR` |
| `StorageError` | IndexedDB failures | `STORAGE_ERROR` |
| `AuthError` | Authentication failures | `AUTH_ERROR` |

**Error Handling Pattern:**
```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  if (error instanceof DRFParseError) {
    logger.logError('Parse failed', { code: error.code, context: error.context });
    addToast(`Parse error: ${error.message}`, 'critical');
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

### API Response Types

**AI Analysis Response:**
```typescript
interface AIAnalysisResponse {
  success: boolean;
  analyses: AIAnalysisResult[];
  errors?: string[];
  cached: boolean;
  timestamp: number;
}
```

**Scoring Response:**
```typescript
interface RaceScoringResult {
  raceNumber: number;
  horses: ScoredHorse[];
  topPick: ScoredHorse | null;
  confidence: number;
  calculatedAt: number;
}
```

**Validation Response:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    totalFields: number;
    populatedFields: number;
    completenessPercent: number;
  };
}
```

---

## UI Architecture

### Routing Mechanism

**Pattern:** State-based routing (not react-router)

**Implementation:** `src/App.tsx`

```typescript
type AppRoute = 'dashboard' | 'account' | 'help' | 'live-viewer';

const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);

// Route rendering
if (currentRoute === 'live-viewer' && liveShareCode) {
  return <ViewerLayout shareCode={liveShareCode} onExit={handleExitViewer} />;
}
if (currentRoute === 'help') {
  return <HelpCenter onBack={navigateToDashboard} />;
}
if (currentRoute === 'account') {
  return <AccountSettings onLogout={handleLogout} onBack={navigateToDashboard} />;
}
return <Dashboard {...props} />;
```

**URL Handling:**
- `/live/:code` — Live viewer route (extracted via `extractShareCodeFromUrl`)
- `/` — Dashboard (default)
- Other routes managed via state, not URL

### Large Components

Components exceeding 500 lines (from UI Audit):

| Component | Lines | Responsibility | Refactoring Notes |
|-----------|-------|----------------|-------------------|
| Dashboard | 800+ | Main layout orchestration | Consider extracting sub-layouts |
| HorseTable | 600+ | Horse list rendering | Extract row logic |
| ScoringBreakdown | 550+ | Score visualization | Extract category components |
| AIAnalysisPanel | 500+ | AI results display | Extract bot result cards |
| BetMode | 500+ | Betting workflow | Extract recommendation list |

### Modal System

**Pattern:** State-driven modals with portal rendering

**Common Modal Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
```

**Modal Types:**
- `ConfirmationModal` — Destructive action confirmation
- `HorseDetailModal` — Full horse breakdown
- `SettingsModal` — User preferences
- `ShareModal` — Live sharing setup

**Keyboard Handling:**
- `Escape` closes modal
- Focus trapped within modal
- Body scroll locked when open

### Design Tokens

**Location:** CSS custom properties and TailwindCSS config

**Color Palette:**
```css
/* Primary Accent */
--color-primary: #19abb5;
--color-primary-hover: #1992a1;
--color-primary-pressed: #1b7583;
--color-primary-light: #36d1da;

/* Backgrounds (Dark Theme) */
--color-bg-base: #0A0A0B;
--color-bg-card: #0F0F10;
--color-bg-elevated: #1A1A1C;

/* Text */
--color-text-primary: #EEEFF1;
--color-text-secondary: #B4B4B6;
--color-text-tertiary: #6E6E70;

/* Borders */
--color-border-subtle: #2A2A2C;
--color-border-prominent: #3A3A3C;

/* Status */
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
```

**Typography:**
```css
/* Font Family */
--font-family: 'Inter', sans-serif;

/* Font Weights */
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Font Scale */
--font-size-h1: 32px;
--line-height-h1: 40px;
--font-size-h2: 24px;
--line-height-h2: 32px;
--font-size-h3: 18px;
--line-height-h3: 24px;
--font-size-body: 14px;
--line-height-body: 20px;
--font-size-small: 12px;
--line-height-small: 16px;
```

**Spacing (8px Grid):**
```css
--spacing-1: 8px;
--spacing-2: 16px;
--spacing-3: 24px;
--spacing-4: 32px;
--spacing-5: 40px;
--spacing-6: 48px;
```

**Data Display:**
```css
/* Tabular numbers for all numeric data */
font-variant-numeric: tabular-nums;
```

---

## Integration Points

### External API Contracts

**Google Gemini API (AI Service):**

```typescript
// Request format
interface GeminiRequest {
  model: string;
  contents: GeminiContent[];
  generationConfig?: GenerationConfig;
}

// Expected response
interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
    finishReason: string;
  }[];
}
```

**Environment Variables:**
```
VITE_GEMINI_API_KEY=<api-key>
```

**Auth Provider (Future):**
```typescript
// Supabase interface (when implemented)
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Firebase interface (when implemented)
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}
```

**Payment Provider (Future):**
```typescript
// Stripe interface (when implemented)
interface StripeConfig {
  publishableKey: string;
  priceIds: {
    pro: string;
    enterprise: string;
  };
}
```

### PWA Configuration

**Manifest:** `public/manifest.json`

```json
{
  "name": "Handicap App",
  "short_name": "Handicap",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#19abb5",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Vite PWA Plugin:**
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Workbox configuration
      }
    })
  ]
};
```

**Service Worker Status:** SCAFFOLDED (manifest exists, full offline caching not yet implemented)

### Build and Deploy Pipeline

**Build Tool:** Vite

**Build Commands:**
```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run typecheck  # TypeScript type checking
npm test           # Run Vitest tests
```

**CI Pipeline:**
- Test runner: Vitest (94 test files)
- Type checking: TypeScript strict mode
- E2E: Playwright (configured)

**Deployment:** Vercel

**Deployment Flow:**
```
Git Push → GitHub → Vercel Build → Vercel Deploy
                        │
                        ▼
                   npm run build
                   npm run typecheck
                   (tests in CI)
```

---

## Data Contracts

### DRF Parser

**Input:** Raw DRF file (CSV-like format, 1,435 fields per horse)

**Output:** `ParsedDRFFile`

```typescript
interface ParsedDRFFile {
  filename: string;
  trackCode: string;
  raceDate: string;
  races: ParsedRace[];
  parseTimestamp: number;
}
```

**Validation:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    totalFields: number;
    populatedFields: number;
    completenessPercent: number;
  };
}

// Validation check
function isDataUsable(result: ValidationResult): boolean {
  return result.isValid || result.stats.completenessPercent > 50;
}
```

**Error Cases:**
- Invalid file format (not DRF)
- Missing required fields
- Corrupt data
- Empty races

### Horse Type

**Complete `HorseEntry` Interface:**

```typescript
interface HorseEntry {
  // Identification
  programNumber: string;
  horseName: string;
  yearOfBirth: number;
  sex: 'C' | 'H' | 'G' | 'F' | 'M' | 'R';
  color: string;
  sire: string;
  dam: string;
  damSire: string;
  breeder: string;
  state: string;

  // Connections
  jockey: JockeyInfo;
  trainer: TrainerInfo;
  owner: string;

  // Race Conditions
  morningLineOdds: number;
  weight: number;
  medication: string;      // 'L' = Lasix, 'B' = Bute
  equipment: string;       // 'b' = blinkers, 'f' = front wraps
  claimingPrice?: number;
  postPosition: number;

  // Performance Records
  pastPerformances: PastPerformance[];  // Up to 10 PPs
  workouts: Workout[];                   // Recent works
  lifetime: LifetimeRecord;
  currentYear: YearRecord;
  previousYear: YearRecord;

  // Track-specific records
  trackRecord: TrackRecord;
  distanceRecord: DistanceRecord;
  surfaceRecord: SurfaceRecord;
}

interface PastPerformance {
  date: string;
  trackCode: string;
  distance: Distance;
  surface: 'dirt' | 'turf' | 'synthetic';
  condition: TrackCondition;
  raceType: RaceType;
  purse: number;
  fieldSize: number;
  postPosition: number;
  positions: RacePositions;  // Calls at various points
  finalTime: string;
  speedFigure: number;
  beyer: number;
  comment: string;
  margin: number;
  odds: number;
  favorite: boolean;
}
```

### Race Type

**Complete `ParsedRace` Interface:**

```typescript
interface ParsedRace {
  // Identification
  raceNumber: number;
  trackCode: string;
  date: string;

  // Conditions
  distance: Distance;
  surface: 'dirt' | 'turf' | 'synthetic';
  condition: TrackCondition;
  raceType: RaceType;
  purse: number;
  conditions: string;      // Full condition text
  restrictions?: string;   // Age/sex restrictions

  // Field
  horses: HorseEntry[];
  fieldSize: number;

  // Timing
  postTime?: string;

  // Track Intelligence
  trackBias?: TrackBias;
  parTime?: number;
}

interface Distance {
  value: number;           // In furlongs
  exact: string;           // "6f", "1 1/16m"
  isRoute: boolean;        // >= 1 mile
}

type TrackCondition = 'fast' | 'good' | 'muddy' | 'sloppy' | 'firm' | 'yielding' | 'soft';

type RaceType =
  | 'maiden'
  | 'maiden-claiming'
  | 'claiming'
  | 'starter-allowance'
  | 'allowance'
  | 'allowance-optional-claiming'
  | 'stakes'
  | 'graded-stakes';
```

### Betting Recommendations

**Output Shape:**

```typescript
interface BettingRecommendation {
  horse: ScoredHorse;
  tier: BettingTier;
  betType: 'win' | 'place' | 'show' | 'exacta' | 'trifecta';
  suggestedUnit: number;      // Based on Kelly
  confidence: number;         // 0-1
  reasoning: string[];        // Human-readable factors
}

interface RaceRecommendations {
  raceNumber: number;
  topPick: BettingRecommendation | null;
  additionalPlays: BettingRecommendation[];
  exoticPlays: ExoticRecommendation[];
  totalSuggestedRisk: number;
  confidence: number;
}

interface ExoticRecommendation {
  type: 'exacta' | 'trifecta' | 'superfecta' | 'pick3' | 'pick4' | 'pick5' | 'pick6';
  combinations: string[][];   // Horse program numbers
  cost: number;
  coverage: number;           // Percentage of likely outcomes
}
```

**Kelly Criterion Implementation:**

```typescript
// Quarter-Kelly for conservative sizing
function calculateBetSize(
  edge: number,           // Expected edge (0-1)
  odds: number,           // Decimal odds
  bankroll: number,       // Current bankroll
  kellyFraction: number = 0.25  // Quarter Kelly default
): number {
  const fullKelly = (edge * odds - (1 - edge)) / odds;
  const fractionalKelly = fullKelly * kellyFraction;
  return Math.max(0, bankroll * fractionalKelly);
}
```

---

## Appendix: File Structure Summary

```
src/
├── components/           # React UI components (89 total)
│   ├── auth/            # Authentication UI
│   ├── help/            # Help center
│   ├── LiveViewer/      # Session sharing
│   └── ...              # Feature components
├── contexts/            # React Context providers (2)
│   ├── AuthContext.tsx
│   └── ToastContext.tsx
├── data/                # Static data (track intelligence)
├── docs/                # Algorithm methodology
├── help/                # Help content
├── hooks/               # Custom React hooks (23-26)
├── legal/               # Legal content
├── lib/                 # Core business logic
│   ├── scoring/         # Scoring engine (50 modules)
│   ├── betting/         # Betting calculations
│   ├── validation/      # Data validation
│   └── supabase/        # Share code utilities
├── services/            # Service layer
│   ├── ai/              # Google Gemini integration
│   ├── auth/            # Auth service (mock)
│   ├── payments/        # Payment service (mock)
│   ├── storage/         # IndexedDB wrapper
│   ├── analytics/       # Event tracking
│   └── logging/         # Structured logging
├── styles/              # CSS stylesheets
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── workers/             # Web Workers (scaffolded)
```

---

_End of TECHNICAL_SPEC.md_
