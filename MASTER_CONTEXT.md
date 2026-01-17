# Handicap App — Master Context Document

> **Single source of truth.** This document serves TWO audiences:
>
> - **Claude Chat sessions** — For planning, brainstorming, and generating prompts
> - **Claude Code sessions** — For executing prompts and writing code
>
> Sections are marked with who they apply to. Read what's relevant to your role.
>
> **Last Updated:** January 2025
> **Algorithm Version:** v3.6 (Phase 7, Form Decay System)
>
> ⚠️ **CRITICAL:** Also read **ALGORITHM_REFERENCE.md** for algorithm details, scoring categories, DRF field indices, and track intelligence schemas. This document was split to prevent truncation.

---

# SECTION 1: PROJECT DEFINITION

## _Applies to: Claude Chat AND Claude Code_

---

## What This App Is

A professional-grade horse racing handicapping progressive web application. It parses DRF (Daily Racing Form) files, applies a deterministic mathematical scoring algorithm, and outputs tiered betting recommendations.

**Core Function:**

- Upload DRF file → Mathematical analysis → Betting recommendations
- Every calculation is deterministic and reproducible
- Works fully offline at the track
- Professional-grade analysis accessible to anyone

**What It Is NOT:**

- NOT a gambling platform — this is a data analysis tool
- NOT a betting app — we do not place bets, hold funds, or facilitate wagering
- NOT customizable algorithms — users adjust inputs, never the math
- NOT a data visualization dashboard — it makes decisions, not just displays

**Legal Positioning:**
This application analyzes publicly available data (DRF files) and provides statistical analysis and recommendations for horse racing enthusiasts. It is a data analysis tool, not a gambling service.

---

## Absolute Rules

_These are foundational constraints. Every decision must respect them._

1. **Algorithm is immutable** — Users adjust inputs, never math
2. **Enterprise architecture** — Scaffolding for auth/payments/AI from day one
3. **Mobile-first** — 375px is primary target
4. **Offline-first** — Core features work without connection
5. **60fps always** — No animation jank
6. **Design system only** — No colors/fonts outside the system
7. **8px grid** — All spacing multiples of 8
8. **Tabular numbers** — All data displays
9. **Deterministic** — Same inputs = same outputs
10. **Atomic prompts** — One focused task per Claude Code session (5-15 requirements typical)
11. **Test before merge** — `npm test` passes, manual verification done
12. **No App Store** — PWA only, direct web access
13. **Overview-first navigation** — Users see all races with confidence before drilling into details
14. **Methodology docs are authoritative** — Code implements what docs define, not the reverse

---

## Glossary

_Terms used throughout this document and the codebase._

| Term | Definition |
|------|------------|
| **DRF** | Daily Racing Form — industry-standard data provider. Files purchased from DRF.com as .drf or .txt files containing 1,435 fields per horse entry |
| **Speed Figure** | Numerical rating (typically 0-120) measuring how fast a horse ran, adjusted for track and conditions |
| **Pace** | How a race unfolds — early speed, mid-race positioning, closing kick |
| **Overlay** | Race-day adjustment applied after base scoring — accounts for factors visible only on race day |
| **Trip Notes** | Comments describing a horse's journey during a race (traffic trouble, wide trips, etc.) |
| **Connections** | Trainer + Jockey combination, plus their historical partnership success |
| **Class** | Competition level — claiming prices, stakes grades, allowance conditions |
| **Form Cycle** | A horse's current competitive condition based on recent performances |
| **Bias** | Track tendency favoring certain running styles or post positions |
| **PP** | Past Performance — historical race data for a horse |
| **Tier** | Betting classification based on final score (Tier 1 = strongest plays) |
| **Confidence** | Data completeness rating affecting score reliability |

---

## The Human

**Nick** — Non-technical founder, zero coding experience.

- Uses Claude Code (web-based, GitHub-integrated) exclusively
- Will paste prompts verbatim — relies entirely on Claude for technical decisions
- Communication style: Direct, no-nonsense, bite-sized prompts only
- Building for personal use initially, architecting for SaaS from day one

---

## Architecture Philosophy

### Enterprise From Day One

This is not "build simple, scale later." Every feature includes its enterprise scaffolding:

**Authentication Scaffolding:**

- Auth provider abstraction (Supabase/Firebase ready)
- Auth context and hooks exist even if login is disabled during dev
- Protected route patterns in place
- User state management separate from app state

**Subscription Scaffolding:**

- Stripe integration points defined
- Single tier model (pay or no access, monthly only)
- No refunds — proprietary algorithm, not for single-use abuse
- Cancel anytime — stops next billing cycle, access continues until period ends
- Feature flags ready to gate functionality
- Subscription status checked on protected routes

**Usage Tracking Infrastructure:**

- Track: DRF files parsed, races analyzed, sessions, features used
- Store: User activity log with timestamps
- Purpose: Analytics, feature usage insights, system health monitoring
- Privacy-conscious: minimal data, clear purpose

**AI Service Layer:**

- Abstract interface at `src/services/ai/`
- Provider-agnostic (Gemini, Claude API, OpenAI — swap without touching components)
- Disabled until activated
- Requires online connection
- Potential features: race narratives, natural language queries, trip note interpretation
- Files: `index.ts`, `gemini.ts`, `types.ts`, `prompt.ts`

**Error Handling:**

- Error boundaries on every major component (Dashboard, RaceOverview, RaceDetail, FileUpload)
- Graceful degradation: show cached data > show empty state with message > show error boundary
- Logging abstraction (console in dev, Sentry/LogRocket ready for prod)
- Error types defined in `src/types/errors.ts`
- No unhandled crashes ever

**State Management:**

- Four separate contexts: UI state, race data state, user state, calculation state
- React Context + useReducer (no external state libraries)
- Existing contexts: `AuthContext.tsx`, `ToastContext.tsx`
- 20+ hooks in `src/hooks/`
- Scales without becoming spaghetti

**Testing Infrastructure:**

- **Framework:** Vitest (with @vitest/coverage-v8)
- **E2E:** Playwright configured
- **Test location:** Co-located in `__tests__` directories
- **Run command:** `npm test`
- Unit tests for scoring logic, parsers, utilities
- Integration tests for user flows
- CI pipeline rejects broken code

---

## PWA Architecture

### Why PWA (Not App Store)

- **No App Store cut** — Keep 97% (Stripe only) vs 70-85% (after Apple/Google)
- **No App Store review** — Bypass gambling-adjacent scrutiny entirely
- **Instant updates** — Push fixes, everyone gets them immediately
- **Single codebase** — One React app serves all devices
- **Offline capability** — Full functionality at the track with no signal
- **Install to home screen** — Native app feel without native app overhead

### Offline-First Design

**Works Offline:**

- DRF file parsing
- All scoring calculations
- Track intelligence lookups
- Betting recommendations
- Previously loaded race data

**Requires Online:**

- Authentication/login
- Subscription validation
- AI features (when implemented)
- Live odds updates (future)

**Implementation:**

- Service worker caches app shell and static assets (cache-first)
- IndexedDB stores track intelligence database
- IndexedDB stores parsed race data locally
- Sync queue for when connection returns

### IndexedDB Schema

```typescript
// Store: tracks
interface TrackStore {
  code: string;           // Primary key: "CD", "SAR", "GP"
  data: TrackIntelligence;
  lastUpdated: number;    // Unix timestamp
}

// Store: races
interface RaceStore {
  id: string;             // Primary key: "{trackCode}-{date}-{raceNumber}"
  parsed: ParsedRace;
  scores: HorseScore[];
  timestamp: number;
}

// Store: sessions
interface SessionStore {
  id: string;             // Primary key
  fileHash: string;
  races: string[];        // Race IDs
  created: number;
}
```

---

## Design Philosophy

### Progressive Complexity

**Surface (5-year-old can use it):**

- Upload file → See picks → Done
- Zero cognitive load
- Big buttons, clear outcomes

**Mid-Level (casual bettor):**

- Why is this horse ranked #1?
- What does 82% confidence mean?
- How much should I bet?

**Deep Level (pro handicapper):**

- Full scoring breakdowns by category
- Pace scenario analysis
- Track bias data
- Trip note parsing
- Every data point accessible

**The Rule:** Nobody is forced into complexity. Depth is always opt-in.

### The Fort Knox Principle

**The algorithm is immutable.**

Users CAN:

- View scoring methodology
- Understand why Horse X scored Y points
- See every contributing factor
- Adjust inputs (scratches, track condition, live odds)

Users CANNOT:

- Change point allocations
- Modify category weights
- Override tier thresholds
- Alter mathematical formulas

Inputs change → System recalculates → Math stays constant.

---

## Technical Stack

| Layer            | Technology                        |
| ---------------- | --------------------------------- |
| Framework        | React 18+ with TypeScript         |
| Build            | Vite                              |
| Styling          | CSS + Material Design 3 patterns (custom color palette) |
| Icons            | Google Material Icons             |
| Typography       | Inter (Google Fonts)              |
| State            | React Context + useReducer        |
| Local Storage    | IndexedDB                         |
| Workers          | Web Workers (DRF parsing)         |
| Animations       | Framer Motion (complex), CSS transitions (simple) |
| PWA              | Service Worker + Web App Manifest |
| Testing          | Vitest + Playwright               |
| Deployment       | Vercel                            |
| Auth (ready)     | Supabase or Firebase              |
| Payments (ready) | Stripe                            |
| AI (ready)       | Gemini / Claude API / OpenAI      |

### Repository

- **GitHub:** `tacctile/handicap_app`
- **Branch:** `main` (direct commits for now)
- **Deploy:** Vercel auto-deploys on merge
- **Commit format:** `[area]: description` (e.g., `[scoring]: fix pace calculation`)

### TypeScript Configuration

All strict mode settings enabled:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- `noUncheckedIndexedAccess: true`

### Performance Targets

| Metric            | Target                      |
| ----------------- | --------------------------- |
| DRF Parse         | <2 seconds (12-horse field) |
| Score Calculation | <100ms (full field)         |
| Animation         | 60fps constant              |
| Bundle Size       | <500kb gzipped              |
| TTI               | <3 seconds                  |

---

## Design System

### Color Palette

**Primary Accent:**

```
Primary:    #19abb5
Hover:      #1992a1
Pressed:    #1b7583
Light:      #36d1da
```

**Backgrounds (Dark Theme Default):**

```
Base:       #0A0A0B
Cards:      #0F0F10
Elevated:   #1A1A1C
```

**Text:**

```
Primary:    #EEEFF1
Secondary:  #B4B4B6
Tertiary:   #6E6E70
```

**Borders:**

```
Subtle:     #2A2A2C
Prominent:  #3A3A3C
```

**Status:**

```
Success:    #10b981
Warning:    #f59e0b
Error:      #ef4444
```

**Score Colors (Final Score Range: 0-368):**

```
220+ pts:   #36d1da (exceptional)
200-219:    #36d1da (elite)
180-199:    #19abb5 (strong)
160-179:    #1b7583 (competitive)
140-159:    #888888 (marginal)
<140:       #555555 (pass)
```

### Typography

**Font:** Inter

**Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**Scale:**

```
H1:     32px / 40px
H2:     24px / 32px
H3:     18px / 24px
Body:   14px / 20px
Small:  12px / 16px
```

**Rules:**

- Tabular numbers (`font-variant-numeric: tabular-nums`) for all data
- 8px spacing grid — all margins/padding multiples of 8

### Responsive Design

**Mobile-first. 375px is the primary design target.**

```css
@media (min-width: 640px) {
  /* sm: tablet portrait */
}
@media (min-width: 768px) {
  /* md: tablet landscape */
}
@media (min-width: 1024px) {
  /* lg: desktop */
}
@media (min-width: 1280px) {
  /* xl: large desktop */
}
```

---

## Application Structure

### Overview-First Navigation

**User Flow:** Upload DRF file → Race Overview (all races) → Click race → Race Detail → Back to Overview

**Primary View: Race Overview**

- Displays ALL races from parsed DRF file as cards
- Each card shows: race number, distance, surface, class, confidence badge
- Confidence badges use color-coded indicators (High/Moderate/Low)
- Tier 1 picks highlighted with accent styling
- Click any race card to drill into details

**Secondary View: Race Detail**

- Full horse-by-horse analysis
- Scoring breakdowns, betting recommendations
- Controls for scratches, odds updates, track conditions
- Back button + Escape key returns to Overview
- Confidence recalculates on changes

### Component Architecture

```
src/
├── main.tsx
├── App.tsx
├── index.css
│
├── components/
│   ├── Dashboard.tsx          # View orchestrator (overview vs detail)
│   ├── RaceOverview.tsx       # All races grid with confidence badges
│   ├── RaceDetail.tsx         # Single race deep dive
│   ├── FileUpload.tsx
│   ├── RaceTable.tsx          # Horse table within detail view
│   ├── RaceControls.tsx
│   ├── BettingRecommendations.tsx
│   ├── HorseDetailModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── MobileNav.tsx
│   └── cards/
│
├── contexts/
│   ├── AuthContext.tsx
│   └── ToastContext.tsx
│
├── hooks/                     # 20+ hooks
│   ├── useRaceState.ts
│   ├── useAuth.ts
│   ├── useSubscription.ts
│   └── ... (many more)
│
├── services/
│   ├── ai/
│   │   ├── index.ts           # Abstract interface
│   │   ├── gemini.ts          # Gemini implementation
│   │   ├── types.ts
│   │   └── prompt.ts
│   ├── auth/
│   │   └── index.ts
│   ├── payments/
│   │   └── stripe.ts
│   ├── storage/
│   │   ├── index.ts
│   │   ├── secure.ts
│   │   └── sessions.ts
│   └── analytics/
│       └── usage.ts
│
├── lib/
│   ├── drfParser.ts
│   ├── drfWorker.ts
│   ├── validation.ts
│   ├── confidence.ts
│   ├── scoring/              # 25+ modules
│   │   ├── index.ts
│   │   ├── baseScoring.ts
│   │   ├── speedClass.ts
│   │   ├── form.ts
│   │   ├── pace.ts
│   │   ├── connections.ts
│   │   ├── postPosition.ts
│   │   ├── equipment.ts
│   │   ├── overlayScoring.ts
│   │   └── ... (many more)
│   ├── betting/
│   │   ├── index.ts
│   │   ├── tierClassification.ts
│   │   └── betRecommendations.ts
│   └── calculations/
│       └── recalculate.ts
│
├── data/
│   └── tracks/
│
├── types/
│   ├── drf.ts
│   ├── scoring.ts
│   ├── errors.ts
│   └── index.ts
│
└── styles/
    ├── dashboard.css
    └── responsive.css
```

---

## Build Roadmap

**Scope definition only. All boxes unchecked. Actual state determined by snapshot.**

### Phase 1: Foundation
- [ ] Project scaffolding (Vite + React + TypeScript)
- [ ] Design system implementation (colors, typography, spacing)
- [ ] Component library (buttons, cards, inputs, modals)
- [ ] Responsive layout shell (mobile-first)
- [ ] Error boundary architecture
- [ ] PWA manifest and service worker shell

### Phase 2: Core Data Layer
- [ ] DRF parser (all 1,435 fields)
- [ ] Web Worker for off-thread parsing
- [ ] TypeScript interfaces for all data types
- [ ] Validation layer
- [ ] IndexedDB storage for parsed data

### Phase 3: Track Intelligence
- [ ] Track schema definition
- [ ] Track data files (40+ tracks)
- [ ] Track lookup service
- [ ] Fallback handling for unknown tracks
- [ ] Bias calculation helpers

### Phase 4: Scoring Engine
- [ ] Speed Figures scoring (90 pts)
- [ ] Form scoring (50 pts)
- [ ] Pace scoring (45 pts)
- [ ] Class scoring (32 pts)
- [ ] Connections scoring (27 pts)
- [ ] All remaining categories
- [ ] Overlay calculations (±40 cap)
- [ ] Final score aggregation
- [ ] Edge case protocols

### Phase 5: Betting Logic
- [ ] Tier classification
- [ ] Bet type recommendations
- [ ] Unit sizing calculations
- [ ] Confidence calibration
- [ ] Multi-race optimization (pick 3/4/5)

### Phase 6: User Interface
- [ ] File upload flow
- [ ] Race Overview screen
- [ ] Race Detail screen
- [ ] View management
- [ ] Horse table/cards (responsive)
- [ ] Scoring breakdown panels
- [ ] Betting recommendations display
- [ ] Horse detail modal
- [ ] Scratch/conditions controls
- [ ] Real-time recalculation feedback
- [ ] Keyboard navigation

### Phase 7: Enterprise Scaffolding
- [ ] Auth service abstraction
- [ ] Auth context and hooks
- [ ] Protected route patterns
- [ ] Stripe service abstraction
- [ ] Subscription status hooks
- [ ] Usage tracking service
- [ ] Analytics abstraction

### Phase 8: AI Integration (Scaffolding)
- [ ] AI service interface
- [ ] Provider abstraction (Gemini/Claude/OpenAI)
- [ ] Feature flags for AI features
- [ ] AI query components (hidden until enabled)

### Phase 9: Offline & PWA
- [ ] Service worker implementation
- [ ] Cache strategies (app shell, track data)
- [ ] IndexedDB sync patterns
- [ ] Offline indicator UI
- [ ] Install prompt handling
- [ ] Background sync queue

### Phase 10: Testing & Quality
- [ ] Unit tests for scoring modules
- [ ] Unit tests for parser
- [ ] Integration tests for user flows
- [ ] CI pipeline (GitHub Actions)
- [ ] Performance monitoring hooks
- [ ] Error logging abstraction

### Phase 11: Legal & Compliance
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Data analysis tool disclaimers
- [ ] No-refund policy documentation

### Phase 12: Launch Prep
- [ ] Production environment config
- [ ] Stripe production setup
- [ ] Auth production setup
- [ ] Performance audit
- [ ] Security audit
- [ ] Final QA pass

---

# SECTION 2: CLAUDE CODE INSTRUCTIONS

## _Applies to: Claude Code sessions ONLY_

---

## What You Are

You are executing a prompt in a fresh session. You have no memory of previous sessions. Your only context comes from:

1. The prompt you were given
2. The files in the codebase (including MASTER_CONTEXT.md, ALGORITHM_REFERENCE.md, and methodology docs)

---

## Mandatory Reading — Every Session

**Before executing ANY prompt, read these files in order:**

1. **MASTER_CONTEXT.md** — Project definition, architecture, design system
2. **ALGORITHM_REFERENCE.md** — Algorithm details, scoring categories, DRF fields, track intelligence
3. **src/docs/METHODOLOGY_INDEX.md** — Master index linking all methodology documentation

**Then, based on the task, read relevant methodology docs:**

| If the task involves...                | Also read...                    |
| -------------------------------------- | ------------------------------- |
| Scoring, points, categories            | src/docs/SCORING_ENGINE.md      |
| DRF parsing, field extraction          | src/docs/DRF_FIELD_MAP.md       |
| Race-day adjustments, pace analysis    | src/docs/OVERLAY_SYSTEM.md      |
| Longshots, first-timers, special cases | src/docs/EDGE_CASE_PROTOCOLS.md |
| Bet construction, tiers, output format | src/docs/BETTING_TIERS.md       |
| Track data, bias, connections          | src/docs/TRACK_INTELLIGENCE.md  |
| Ranking, blended analysis              | src/docs/BLENDED_RANK.md        |
| Trend analysis                         | src/docs/TREND_RANK.md          |

**When in doubt, read all of them.** These documents ARE the algorithm specification. The code implements what they define.

---

## What To Do

1. **Read mandatory files first** — MASTER_CONTEXT.md, ALGORITHM_REFERENCE.md, then METHODOLOGY_INDEX.md, then relevant methodology docs based on task.

2. **Read prompt reference files** — Any additional files listed in the prompt's "REFERENCE FILES TO READ FIRST" section.

3. **Execute the requirements** — Do exactly what's listed, in order.

4. **Respect the DO NOT list** — These are hard constraints. Do not violate them.

5. **Verify test scenarios** — Check each scenario works as described.

6. **Provide completion report** — List files created/modified, what was done, any issues.

---

## What NOT To Do

- **Do NOT generate prompts** — That's Claude Chat's job
- **Do NOT modify files outside the scope** — Only touch what's specified
- **Do NOT skip the completion report** — Nick needs it to verify the work
- **Do NOT deviate from methodology docs** — They define the algorithm; code implements them exactly

---

## Failure Handling Protocol

**If a referenced file doesn't exist:**
- Note in completion report: "File not found: [path]"
- Proceed with best interpretation if possible
- If critical to task, stop and document why

**If requirements conflict with methodology docs:**
- Methodology docs win
- Document the conflict in completion report
- Implement per methodology docs

**If requirements are ambiguous or impossible:**
- Document the ambiguity in completion report
- Proceed with best interpretation
- Flag for Nick's review

**If npm test fails for unrelated reasons:**
- Document the failure
- Note which tests failed and why
- Complete the task if tests are unrelated to changes

**If a prompt spans multiple domains:**
- Read all relevant methodology docs
- Document which docs informed the implementation

---

## Conflict Resolution Hierarchy

When documents or instructions conflict, this is the priority order:

1. **Methodology docs in src/docs/** — Highest authority for algorithm
2. **MASTER_CONTEXT.md + ALGORITHM_REFERENCE.md** — Project architecture and constraints
3. **Existing code patterns** — Follow established conventions
4. **Prompt instructions** — Specific task requirements

If Nick's prompt explicitly contradicts methodology docs, note the conflict and ask for clarification in the completion report.

---

## Status Definitions

| Status      | Meaning |
|-------------|---------|
| COMPLETE    | Fully implemented, tested, working |
| IN-PROGRESS | Partially implemented, not fully functional |
| STUB        | Function exists, returns hardcoded/mock data |
| PLACEHOLDER | File exists but is empty or minimal |
| SCAFFOLDED  | Structure in place, no real implementation |
| WIRED       | Connected and functional |
| NOT STARTED | Does not exist |

---

## Methodology Docs Are Authoritative

The methodology documentation in `src/docs/` represents tens of hours of handicapping research and refinement. These documents define:

- Exact point allocations for every scoring category
- Precise formulas for overlay calculations
- Specific thresholds for betting tiers
- Complete protocols for edge cases
- Track data schema requirements

**The code must implement these specifications exactly.** If there's a conflict between existing code and methodology docs, the methodology docs are correct and the code should be updated.

---

## File Locations Reference

```
MASTER_CONTEXT.md              # Root — project definition, architecture
ALGORITHM_REFERENCE.md         # Root — algorithm, scoring, DRF fields, track intel
src/docs/
├── METHODOLOGY_INDEX.md       # Entry point for all methodology
├── ALGORITHM_V3_SUMMARY.md    # Current v3.6 algorithm (328-pt base, 15 categories)
├── SCORING_ENGINE.md          # Detailed scoring reference
├── DRF_FIELD_MAP.md           # All 1,435 DRF fields mapped (exact indices)
├── OVERLAY_SYSTEM.md          # ±40 race-day adjustments (capped)
├── EDGE_CASE_PROTOCOLS.md     # Diamond, Nuclear, Lightly Raced, Late-Breaking
├── BETTING_TIERS.md           # Three-tier structure, bet construction
├── TRACK_INTELLIGENCE.md      # Track schema, integration
├── BLENDED_RANK.md            # Blended ranking methodology
└── TREND_RANK.md              # Trend analysis methodology

src/lib/
├── drfParser.ts               # DRF parsing implementation
└── scoring/index.ts           # Scoring calculations (main entry point)

src/types/
├── drf.ts                     # DRF data interfaces
├── scoring.ts                 # Scoring interfaces
├── errors.ts                  # Error types
└── index.ts                   # Barrel export
```

---

## Enterprise Quality Standards

_Applies to ALL code written in this project._

- All new functions must have error handling (try/catch with logging)
- All external inputs must be validated/sanitized before use
- All new modules must include corresponding test file
- No console.log in production code — use logging service
- No 'any' types — explicit TypeScript typing required
- All async operations must handle failure states
- New components must be wrapped in ErrorBoundary or handle errors gracefully
- Code must pass TypeScript strict mode
- Follow existing patterns in codebase — don't introduce new paradigms without justification

---

_End of Section 2_

---

# SECTION 3: PROMPT FORMAT

## _Applies to: Claude Chat (for writing) AND Claude Code (for executing)_

---

## Standard Prompt Structure

Every prompt sent to Claude Code must follow this exact structure:

```
TASK:
[Single sentence — what needs to be done]

CONTEXT:
[Current state, what exists, why this change is needed]

REFERENCE FILES TO READ FIRST:
- MASTER_CONTEXT.md
- ALGORITHM_REFERENCE.md
- src/docs/[relevant methodology doc]
- src/path/to/relevant/file.ts

DEPENDENCIES:
[List any features/files this prompt assumes are working]

---

EXPLICIT REQUIREMENTS:

PART 1 - [CATEGORY]:

1. Specific requirement
2. Specific requirement
3. Specific requirement

PART 2 - [CATEGORY]:

4. Specific requirement
5. Specific requirement

TESTING REQUIREMENTS:

6. Create tests in src/[module]/__tests__/
7. Test: [scenario]
8. Test: [scenario]
9. Ensure npm test passes

---

DO NOT DO ANY OF THE FOLLOWING:

- Do not modify files outside [specific directories]
- Do not change [specific files that are working]
- Do not add dependencies without listing them here
- Do not alter colors/typography outside design system
- [Task-specific constraints]

---

IF BLOCKED:

- If [specific scenario], then [specific action]
- If requirements conflict with methodology docs, follow methodology docs and note in report

---

TEST VERIFICATION:

Scenario A - [Name]:
1. Step
2. Step
3. Expected result

Scenario B - [Name]:
1. Step
2. Step
3. Expected result

---

COMPLETION REPORT:

When finished, provide:
- Files created (full paths)
- Files modified (full paths)
- What each change does
- Dependencies added (if any)
- Issues encountered
- Conflicts with methodology docs (if any)
- Confirmation all tests pass
```

### Formatting Rules

1. **Entire prompt in ONE code block** — One-click copy
2. **Plain text inside** — No markdown formatting within the code block
3. **Numbered requirements** — Easy reference
4. **Named test scenarios** — "Scenario A - Upload parses correctly"
5. **Full file paths** — Always from project root
6. **Specific values** — "100ms" not "fast", "#19abb5" not "teal"
7. **MASTER_CONTEXT.md + ALGORITHM_REFERENCE.md always first** — In every reference file list
8. **Task-specific DO NOTs** — Not generic placeholders

---

# SECTION 4: CLAUDE CHAT INSTRUCTIONS

## _Applies to: Claude Chat sessions ONLY_

## _Claude Code: SKIP THIS ENTIRE SECTION_

---

## Session Continuity Protocol

At the start of each new Claude Chat session:

1. Search last 3-5 conversations about this app
2. Retrieve: what was being worked on, decisions made, blockers, where we left off
3. Proceed as if you remember previous sessions

**Do not ask permission to search. Do not announce that you searched. Just do it and continue.**

---

## Prompt Generation

Claude Chat creates prompts for Claude Code. Every prompt must follow the format in Section 3.

**Key principle:** Claude Chat plans and writes prompts. Claude Code executes them. No code is written in Chat sessions.

---

## Mandatory First Action

**Before any planning, brainstorming, or prompt generation, get a current snapshot.**

Generate this exact prompt for Nick to paste into Claude Code:

```
TASK:
Generate a technical snapshot of the current codebase state for project handoff.

CONTEXT:
A new Claude session needs to understand exactly what exists in this codebase. This snapshot will be shared with Claude Chat to enable accurate planning and prompt generation.

REFERENCE FILES TO READ FIRST:
- MASTER_CONTEXT.md
- ALGORITHM_REFERENCE.md

DEPENDENCIES:
- None

---

EXPLICIT REQUIREMENTS:

1. List all directories in src/ with brief description of purpose

2. For each component in src/components/:
   - File name
   - Status: COMPLETE | IN-PROGRESS | STUB | PLACEHOLDER
   - Brief description of what it does

3. For src/lib/:
   - List all modules
   - Status of each: FUNCTIONAL | PARTIAL | STUB
   - What works vs what's placeholder

4. For src/data/tracks/:
   - How many tracks are defined
   - List track codes that exist
   - Schema status

5. For src/services/:
   - What services exist
   - Status of each: WIRED | SCAFFOLDED | NOT STARTED

6. For src/hooks/:
   - List all hooks
   - What each manages

7. State management:
   - What contexts exist
   - How state is organized
   - What triggers recalculation

8. PWA status:
   - Service worker: EXISTS | NOT STARTED
   - Manifest: EXISTS | NOT STARTED
   - Offline capability: WORKING | PARTIAL | NONE

9. Testing status:
   - Test files exist: YES | NO
   - Framework: Vitest | Jest | Other
   - Coverage estimate
   - CI pipeline: CONFIGURED | NOT CONFIGURED

10. Known issues or tech debt:
    - List any TODOs in code
    - Known bugs
    - Incomplete features

---

DO NOT DO ANY OF THE FOLLOWING:

- Do not modify any files
- Do not create any files
- Do not make any changes to the codebase
- This is READ-ONLY analysis

---

IF BLOCKED:

- If a directory doesn't exist, report "NOT FOUND"
- If unable to read a file, report the error

---

COMPLETION REPORT:

Provide the snapshot as a structured document with clear sections matching the requirements above. This will be copy/pasted back to Claude Chat for project continuity.
```

**After Nick provides the snapshot, proceed with planning and prompt generation based on actual codebase state.**

---

## Technical Snapshot Freshness

Before planning, check if any of these occurred since last snapshot:

- Added or removed a major component or service
- Changed state management patterns
- Modified data flow or calculation pipeline
- Completed a major refactor
- Changed the DRF parsing structure
- Added new track intelligence patterns

**If YES:** Request fresh snapshot first.
**If NO:** Proceed with current understanding.

---

_End of MASTER_CONTEXT.md_
