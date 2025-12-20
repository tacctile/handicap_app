# Claude Code Instructions

> **Read this file first. Always. No exceptions.**

---

## Mandatory Reading — Every Session

Before executing ANY task, read these files in this order:

```
1. MASTER_CONTEXT.md                    # Project definition, architecture, design system
2. src/docs/METHODOLOGY_INDEX.md        # Algorithm documentation entry point
3. Relevant methodology docs (see table below)
4. Any files specified in the prompt
```

### Methodology Doc Selection

| Task Type | Required Reading |
|-----------|------------------|
| Scoring, points, categories | src/docs/SCORING_ENGINE.md |
| DRF parsing, field extraction | src/docs/DRF_FIELD_MAP.md |
| Race-day adjustments, pace, overlays | src/docs/OVERLAY_SYSTEM.md |
| Longshots, first-timers, edge cases | src/docs/EDGE_CASE_PROTOCOLS.md |
| Bet construction, tiers, output | src/docs/BETTING_TIERS.md |
| Track data, bias, connections | src/docs/TRACK_INTELLIGENCE.md |

**When uncertain which docs apply, read all six.** They are the algorithm specification. Code implements what they define exactly.

---

## Project Identity

**Name:** Handicap App
**Type:** Professional horse racing handicapping PWA
**Function:** Parse DRF files → Apply deterministic scoring → Output betting recommendations
**Legal Position:** Data analysis tool, NOT gambling platform

---

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | React 18+ | Functional components only |
| Language | TypeScript | Strict mode, no `any` types |
| Build | Vite | |
| Styling | CSS | Material Design 3 patterns |
| Icons | Google Material Icons | No other icon libraries |
| Typography | Inter | Google Fonts |
| State | React Context + useReducer | NO external state libraries (no Redux, Zustand, etc.) |
| Local Storage | IndexedDB | For offline data |
| Heavy Processing | Web Workers | DRF parsing runs off-thread |
| Animations | Framer Motion | 60fps always |
| PWA | Service Worker + Manifest | Offline-first |
| Deployment | Vercel | Auto-deploys on merge to main |

---

## Architecture Rules

### State Management
- React Context + useReducer ONLY
- Separated concerns: UI state, race data state, user state, calculation state
- No prop drilling beyond 2 levels — create context instead

### Component Patterns
- Functional components only (no class components)
- Custom hooks for reusable logic
- Error boundaries on every major component
- Lazy loading for heavy components

### File Organization
```
src/
├── components/          # React components
│   ├── layout/          # Sidebar, TopBar, MobileNav
│   └── cards/           # Reusable card components
├── hooks/               # Custom React hooks
├── services/            # External integrations (auth, payments, AI)
├── lib/                 # Core logic (parser, scoring, betting)
│   ├── scoring/         # One file per category
│   └── betting/         # Tier classification, recommendations
├── data/                # Static data
│   └── tracks/          # Track intelligence files
├── types/               # TypeScript interfaces
├── styles/              # CSS files
└── docs/                # Methodology documentation
```

### Naming Conventions
- Components: PascalCase (`RaceTable.tsx`)
- Hooks: camelCase with `use` prefix (`useRaceState.ts`)
- Utilities: camelCase (`drfParser.ts`)
- Types: PascalCase (`DRFHorse`, `TrackIntelligence`)
- CSS: kebab-case (`race-table.css`)
- Track files: UPPERCASE track code (`CD.ts`, `SAR.ts`)

---

## Design System — Strict Adherence

### Colors

**DO NOT use any colors outside this palette.**

```css
/* Primary Accent */
--primary: #19abb5;
--primary-hover: #1992a1;
--primary-pressed: #1b7583;
--primary-light: #36d1da;

/* Backgrounds (Dark Theme) */
--bg-base: #0A0A0B;
--bg-card: #0F0F10;
--bg-elevated: #1A1A1C;

/* Text */
--text-primary: #EEEFF1;
--text-secondary: #B4B4B6;
--text-tertiary: #6E6E70;

/* Borders */
--border-subtle: #2A2A2C;
--border-prominent: #3A3A3C;

/* Status */
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;

/* Score Tiers */
--score-elite: #36d1da;      /* 200+ pts */
--score-strong: #19abb5;     /* 180-199 */
--score-competitive: #1b7583; /* 160-179 */
--score-marginal: #888888;   /* 140-159 */
--score-pass: #555555;       /* <140 */
```

### Typography

**Font:** Inter (Google Fonts) — no other fonts

**Weights:** 400, 500, 600, 700 only

**Scale:**
- H1: 32px/40px
- H2: 24px/32px
- H3: 18px/24px
- Body: 14px/20px
- Small: 12px/16px

**Rules:**
- `font-variant-numeric: tabular-nums` on ALL numerical data
- No font sizes outside the scale

### Spacing

**8px grid — ALL spacing must be multiples of 8**

```css
/* Valid */
margin: 8px;
padding: 16px;
gap: 24px;

/* Invalid */
margin: 10px;
padding: 15px;
gap: 30px;
```

### Responsive Breakpoints

**Mobile-first. 375px is the primary design target.**

```css
/* Default styles target mobile */
@media (min-width: 640px)  { /* sm: tablet portrait */ }
@media (min-width: 768px)  { /* md: tablet landscape */ }
@media (min-width: 1024px) { /* lg: desktop */ }
@media (min-width: 1280px) { /* xl: large desktop */ }
```

---

## Algorithm Rules — Immutable

### The Fort Knox Principle

**The algorithm is immutable. Users CANNOT change the math.**

Users CAN:
- View scoring methodology
- Understand why Horse X scored Y points
- Adjust inputs (scratches, track condition, live odds)

Users CANNOT:
- Change point allocations
- Modify category weights
- Override tier thresholds
- Alter mathematical formulas

**Inputs change → System recalculates → Math stays constant.**

### Scoring Structure

```
Base Score:     0-240 points (6 categories)
DRF Overlay:    ±50 points (race-day adjustments)
Final Score:    0-250 points (overflow = confidence boost)
```

### Betting Tiers

| Tier | Score | Action |
|------|-------|--------|
| 1 (Chalk) | 180+ | Primary bets |
| 2 (Alternatives) | 160-179 | Secondary bets |
| 3 (Value) | 140-159 | Small stabs |
| Pass | <140 | No bet |

### Methodology Docs Are Authoritative

If there's a conflict between existing code and methodology docs, **the methodology docs are correct**. Update the code to match.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| DRF Parse | <2 seconds (12-horse field) |
| Score Calculation | <100ms (full field) |
| Animation | 60fps constant |
| Bundle Size | <500kb gzipped |
| TTI | <3 seconds |

---

## PWA Requirements

### Offline-First Design

**Must work offline:**
- DRF file parsing
- All scoring calculations
- Track intelligence lookups
- Betting recommendations
- Previously loaded race data

**Requires online:**
- Authentication/login
- Subscription validation
- AI features
- Live odds (future)

### Service Worker Strategy
- Cache app shell and static assets
- IndexedDB for track intelligence
- IndexedDB for parsed race data
- Sync queue for reconnection

---

## Testing Requirements

### Before Completing Any Task

1. Run `npm test` — must pass
2. Verify changes work in browser
3. Check mobile viewport (375px)
4. Confirm no console errors
5. Test offline behavior if applicable

### Test File Locations
- Unit tests: `src/__tests__/` or colocated `*.test.ts`
- Integration tests: `src/__tests__/integration/`

---

## Services Layer — Scaffolding Pattern

Services are abstracted for future integration:

```
src/services/
├── auth/           # Supabase/Firebase ready
├── payments/       # Stripe ready
├── ai/             # Gemini/Claude/OpenAI ready
└── analytics/      # Usage tracking ready
```

**Pattern:** Create interface → Implement stub → Wire when ready

Do NOT implement actual integrations unless explicitly instructed.

---

## Absolute Prohibitions

1. **NO external state libraries** — React Context + useReducer only
2. **NO colors outside design system** — Check palette before adding any color
3. **NO fonts outside Inter** — No exceptions
4. **NO spacing outside 8px grid** — All values multiples of 8
5. **NO class components** — Functional only
6. **NO `any` types** — Strict TypeScript
7. **NO algorithm modifications** — Methodology docs define the math
8. **NO unhandled errors** — Error boundaries everywhere
9. **NO animation jank** — 60fps or remove the animation
10. **NO App Store builds** — PWA only

---

## Completion Report — Required

Every task must end with:

```
## Completion Report

### Files Created
- path/to/file.ts — description

### Files Modified
- path/to/file.ts — what changed

### What Was Done
- Summary of changes

### Tests
- npm test: PASS/FAIL
- Manual verification: DONE

### Issues Encountered
- Any problems or notes
```

---

## When In Doubt

1. Read MASTER_CONTEXT.md again
2. Read the relevant methodology doc
3. Follow existing patterns in the codebase
4. Prioritize: Working > Perfect
5. If truly stuck, complete what you can and document blockers

---

*This file is the first thing Claude Code reads. It ensures consistent behavior across all sessions.*
