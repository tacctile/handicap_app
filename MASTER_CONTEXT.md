# Handicap App — Master Context Document

> **Single source of truth.** This document serves TWO audiences:
> - **Claude Chat sessions** — For planning, brainstorming, and generating prompts
> - **Claude Code sessions** — For executing prompts and writing code
>
> Sections are marked with who they apply to. Read what's relevant to your role.

---

# SECTION 1: PROJECT DEFINITION
## *Applies to: Claude Chat AND Claude Code*

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

**Error Handling:**
- Error boundaries on every major component
- Graceful degradation
- Logging abstraction (console in dev, Sentry/LogRocket ready for prod)
- No unhandled crashes ever

**State Management:**
- Separated concerns: UI state, race data state, user state, calculation state
- React Context + useReducer (no external state libraries)
- Scales without becoming spaghetti

**Testing Infrastructure:**
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
- Service worker caches app shell and static assets
- IndexedDB stores track intelligence database
- IndexedDB stores parsed race data locally
- Sync queue for when connection returns

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

| Layer | Technology |
|-------|------------|
| Framework | React 18+ with TypeScript |
| Build | Vite |
| Styling | CSS + Material Design 3 patterns |
| Icons | Google Material Icons |
| Typography | Inter (Google Fonts) |
| State | React Context + useReducer |
| Local Storage | IndexedDB |
| Workers | Web Workers (DRF parsing) |
| Animations | Framer Motion |
| PWA | Service Worker + Web App Manifest |
| Deployment | Vercel |
| Auth (ready) | Supabase or Firebase |
| Payments (ready) | Stripe |
| AI (ready) | Gemini / Claude API / OpenAI |

### Repository

- **GitHub:** `tacctile/handicap_app`
- **Branch:** `main`
- **Deploy:** Vercel auto-deploys on merge

### Performance Targets

| Metric | Target |
|--------|--------|
| DRF Parse | <2 seconds (12-horse field) |
| Score Calculation | <100ms (full field) |
| Animation | 60fps constant |
| Bundle Size | <500kb gzipped |
| TTI | <3 seconds |

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

**Score Colors:**
```
200+ pts:   #36d1da (elite)
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
@media (min-width: 640px)  { /* sm: tablet portrait */ }
@media (min-width: 768px)  { /* md: tablet landscape */ }
@media (min-width: 1024px) { /* lg: desktop */ }
@media (min-width: 1280px) { /* xl: large desktop */ }
```

---

## The Algorithm

### Scoring Structure

| Component | Points |
|-----------|--------|
| Base Score | 0-240 (6 categories) |
| DRF Overlay | ±50 (race-day adjustments) |
| **Final Score** | **0-250** (overflow = confidence boost) |

### Base Score Categories

**Category 1: Elite Connections (50 pts max)**
- Trainer: 0-35 pts
- Jockey: 0-15 pts

**Category 2: Post Position & Track Bias (45 pts max)**
- Post Position: 0-30 pts
- Bias Alignment: 0-15 pts

**Category 3: Speed Figures & Class (50 pts max)**
- Speed Figures: 0-30 pts
- Class Level: 0-20 pts

**Category 4: Form Cycle & Conditioning (30 pts max)**
- Recent Form: 0-15 pts
- Layoff Impact: 0-10 pts
- Consistency: 0-5 pts

**Category 5: Equipment & Medication (25 pts max)**
- Equipment Changes: 0-15 pts
- Medication: 0-5 pts
- Shoeing: 0-5 pts

**Category 6: Pace & Tactical (40 pts max)**
- Pace Scenario Fit: 0-25 pts
- Tactical Advantages: 0-15 pts

### DRF Overlay Adjustments

Applied after base scoring:
- Pace Dynamics: ±20 pts
- Form Cycle Specifics: ±15 pts
- Trip Analysis: ±12 pts
- Class Movement: ±15 pts
- Connection Edges: ±10 pts
- Distance/Surface: ±8 pts
- Head-to-Head: ±8 pts

### Betting Tiers

| Tier | Score | Confidence | Hit Rate | Action |
|------|-------|------------|----------|--------|
| 1 (Chalk) | 180+ | High | 50-70% | Primary bets |
| 2 (Alternatives) | 160-179 | Medium | 20-40% | Secondary bets |
| 3 (Value) | 140-159 | Lower | 5-20% | Small stabs |
| Pass | <140 | — | — | No bet |

### Edge Case Protocols

- **Diamond in the Rough:** 120-139 pts with extreme overlay (200%+) gets special review
- **Lightly Raced:** <8 starts triggers breeding-based compensation
- **Nuclear Longshot:** 25/1+ with specific angle gets separate evaluation
- **Late Changes:** Scratches/equipment/jockey changes trigger full recalculation

---

## DRF File Format

### Structure
- CSV format, 1,435 fields per line
- One line per horse entry
- ASCII encoding

### Key Field Groups

| Fields | Content |
|--------|---------|
| 1-27 | Race header (track, date, distance, surface, purse) |
| 28-57 | Horse identity (trainer, jockey, breeding) |
| 62-101 | Lifetime records (starts, wins, earnings) |
| 102-113 | Past performance dates (up to 12) |
| 114-700 | PP details (figures, positions, equipment, margins) |
| 700-900 | Pace figures, fractional times |
| 900-1100 | Trainer/jockey names per PP |
| 1100-1435 | Workouts, extended stats, comments |

### Critical Scoring Fields

- Speed Figures: ~767-776
- Early Pace: ~817-826
- Late Pace: ~847-856
- Running Style: ~211
- Equipment: ~163-172
- Track Condition: ~151-160
- Fractional Times: ~877-916

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
      speedBias: number;     // 0-100
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
- 55% speed bias (neutral)
- Even post distribution
- National average pars
- Reduced confidence flag

---

## Application Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
│
├── components/
│   ├── Dashboard.tsx
│   ├── FileUpload.tsx
│   ├── RaceTable.tsx
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
├── hooks/
│   ├── useRaceState.ts
│   ├── useAuth.ts
│   └── useSubscription.ts
│
├── services/
│   ├── ai/
│   │   ├── index.ts         # Abstract interface
│   │   ├── gemini.ts        # Gemini implementation
│   │   └── types.ts
│   ├── auth/
│   │   └── index.ts
│   ├── payments/
│   │   └── stripe.ts
│   └── analytics/
│       └── usage.ts
│
├── lib/
│   ├── drfParser.ts
│   ├── drfWorker.ts
│   ├── validation.ts
│   ├── scoring/
│   │   ├── index.ts
│   │   ├── connections.ts
│   │   ├── postPosition.ts
│   │   ├── speedClass.ts
│   │   ├── form.ts
│   │   ├── equipment.ts
│   │   └── pace.ts
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
│   ├── user.ts
│   └── subscription.ts
│
└── styles/
    ├── dashboard.css
    └── responsive.css
```

---

## Absolute Rules

1. **Algorithm is immutable** — Users adjust inputs, never math
2. **Enterprise architecture** — Scaffolding for auth/payments/AI from day one
3. **Mobile-first** — 375px is primary target
4. **Offline-first** — Core features work without connection
5. **60fps always** — No animation jank
6. **Design system only** — No colors/fonts outside the system
7. **8px grid** — All spacing multiples of 8
8. **Tabular numbers** — All data displays
9. **Deterministic** — Same inputs = same outputs
10. **Atomic prompts** — One focused task per Claude Code session
11. **Test before merge** — npm test passes, manual verification done
12. **No App Store** — PWA only, direct web access

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
- [ ] Category 1: Connections scoring
- [ ] Category 2: Post position scoring
- [ ] Category 3: Speed/class scoring
- [ ] Category 4: Form cycle scoring
- [ ] Category 5: Equipment scoring
- [ ] Category 6: Pace scenario scoring
- [ ] DRF overlay calculations
- [ ] Final score aggregation
- [ ] Edge case protocols (diamond, nuclear, lightly raced)

### Phase 5: Betting Logic
- [ ] Tier classification
- [ ] Bet type recommendations
- [ ] Unit sizing calculations
- [ ] Confidence calibration
- [ ] Multi-race optimization (pick 3/4/5)

### Phase 6: User Interface
- [ ] File upload flow
- [ ] Race selection interface
- [ ] Horse table/cards (responsive)
- [ ] Scoring breakdown panels
- [ ] Betting recommendations display
- [ ] Horse detail modal
- [ ] Scratch/conditions controls
- [ ] Real-time recalculation feedback

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

# SECTION 2: CLAUDE CHAT INSTRUCTIONS
## *Applies to: Claude Chat sessions ONLY*
## *Claude Code: SKIP THIS ENTIRE SECTION*

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
   - What state exists
   - How it's organized
   - What triggers recalculation

8. PWA status:
   - Service worker: EXISTS | NOT STARTED
   - Manifest: EXISTS | NOT STARTED
   - Offline capability: WORKING | PARTIAL | NONE

9. Testing status:
   - Test files exist: YES | NO
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

# SECTION 3: PROMPT FORMAT
## *Applies to: Claude Chat (for writing) AND Claude Code (for executing)*

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
- src/path/to/relevant/file.ts
- src/path/to/another/file.tsx

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

6. Create tests in appropriate __tests__ directory
7. Test: [scenario]
8. Test: [scenario]
9. Ensure npm test passes

---

DO NOT DO ANY OF THE FOLLOWING:

- Do not modify files outside the specified directories
- Do not change unrelated components
- Do not add dependencies without approval
- Do not alter colors/typography outside design system
- Do not touch [specific files/features that are working]

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
- Issues encountered
- Confirmation all tests pass
```

### Formatting Rules

1. **Entire prompt in ONE code block** — One-click copy
2. **Plain text inside** — No markdown formatting
3. **Numbered requirements** — Easy reference
4. **Named test scenarios** — "Scenario A - Upload parses correctly"
5. **Full file paths** — Always from project root
6. **Specific values** — "100ms" not "fast", "#19abb5" not "teal"
7. **MASTER_CONTEXT.md always first** — In every reference file list

---

# SECTION 4: CLAUDE CODE INSTRUCTIONS
## *Applies to: Claude Code sessions ONLY*

---

## What You Are

You are executing a prompt in a fresh session. You have no memory of previous sessions. Your only context comes from:
1. The prompt you were given
2. The files in the codebase (including MASTER_CONTEXT.md)

---

## What To Do

1. **Read MASTER_CONTEXT.md first** — It's in the reference files list. Read Section 1 (Project Definition) and Section 3 (Prompt Format). Skip Section 2 (Claude Chat Instructions).

2. **Read other reference files** — Understand what exists before making changes.

3. **Execute the requirements** — Do exactly what's listed, in order.

4. **Respect the DO NOT list** — These are hard constraints. Do not violate them.

5. **Verify test scenarios** — Check each scenario works as described.

6. **Provide completion report** — List files created/modified, what was done, any issues.

---

## What NOT To Do

- **Do NOT search past conversations** — You don't have that capability
- **Do NOT generate prompts** — That's Claude Chat's job
- **Do NOT ask for clarification mid-task** — Execute based on what's written
- **Do NOT modify files outside the scope** — Only touch what's specified
- **Do NOT skip the completion report** — Nick needs it to verify the work

---

## Section 2 Is Not For You

Section 2 of this document contains instructions for Claude Chat sessions (session continuity, snapshot protocol, prompt generation). 

**You are Claude Code. Ignore Section 2 entirely.**

Your job is to read Section 1 (understand the project), read Section 3 (understand the prompt format), and execute whatever prompt Nick pastes.

---

*Document Version: 4.0*
*Last Updated: December 2024*
*Repository: tacctile/handicap_app*
