# Handicap App — Master Context Document

> **Single source of truth for project DNA, architecture, and workflow**
>
> **Audience:** Claude Chat (planning) AND Claude Code (execution)
>
> **For algorithm/scoring details, see ALGORITHM_REFERENCE.md**
>
> **Last Updated:** January 2026

---

## Toolchain — READ THIS FIRST

| Tool | Purpose |
|------|---------|
| Claude Chat | Brainstorming, planning, prompt generation |
| Claude Code (Web) | Code execution — paste prompts here |
| GitHub | Repository, version control, CI/CD |
| Vercel | Deployments |

**NOTHING IS EVER DONE LOCALLY. NO EXCEPTIONS.**

- Claude Chat writes prompts
- Claude Code executes prompts
- All code lives in GitHub
- All deploys go through Vercel

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
4. **Offline-first** — (PWA manifest exists, service worker NOT YET IMPLEMENTED)
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

## The Human

**Nick** — Non-technical founder, zero coding experience.

- Uses Claude Code (web-based, GitHub-integrated) exclusively
- Will paste prompts verbatim — relies entirely on Claude for all technical decisions
- Communication style: Direct, no-nonsense, bite-sized prompts only
- Building for personal use initially, architecting for SaaS from day one

---

## Architecture Philosophy

### Authentication Scaffolding

| Path | Purpose |
|------|---------|
| src/services/auth/ | Provider abstraction (Supabase/Firebase ready) |
| src/contexts/AuthContext.tsx | Auth state management |
| src/hooks/useAuth.ts | Auth hook |
| src/components/ProtectedRoute.tsx | Route protection |
| src/components/auth/ | Auth UI components |

**Status:** SCAFFOLDED (returns mock, ready for real provider)

### Subscription Scaffolding

| Path | Purpose |
|------|---------|
| src/services/payments/ | Stripe integration |
| src/hooks/useSubscription.ts | Subscription state |
| src/components/SubscriptionGate.tsx | Subscription checks |
| src/components/subscription/ | Subscription UI |

**Status:** SCAFFOLDED (returns mock, ready for Stripe)

### AI Service Layer

| Path | Purpose |
|------|---------|
| src/services/ai/ | Provider abstraction |

**5 Analysis Bots:**
- Trip Trouble
- Pace Scenario
- Vulnerable Favorite
- Field Spread
- Class Drop

**Provider:** Google Gemini API

**UI Integration:** src/components/AIAnalysisPanel.tsx

**Status:** WIRED AND FUNCTIONAL

### Error Handling

- Error boundaries on major components
- src/types/errors.ts — error type definitions
- Graceful degradation pattern

**Status:** IMPLEMENTED

### State Management

- 2 contexts: AuthContext, ToastContext
- 26 custom hooks in src/hooks/
- React Context + useReducer pattern
- No external state libraries

**Status:** IMPLEMENTED

### Testing Infrastructure

| Aspect | Detail |
|--------|--------|
| Framework | Vitest |
| E2E | Playwright (configured) |
| Test Files | 94 |
| CI Pipeline | Configured |

**Status:** IMPLEMENTED

---

## PWA Architecture

| Aspect | Status |
|--------|--------|
| Manifest | EXISTS (public/manifest.json) |
| Service Worker | NOT YET IMPLEMENTED |
| Offline Capability | PARTIAL (manifest only, no caching) |

**Note:** Full offline-first is architectural goal, not current state.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build | Vite |
| Styling | TailwindCSS + CSS |
| Icons | Google Material Icons |
| Typography | Inter |
| State | React Context + useReducer |
| Storage | IndexedDB (via services) |
| Workers | Web Workers (DRF parsing) |
| Animation | Framer Motion |
| Testing | Vitest + Playwright |
| Hosting | Vercel |
| Auth (ready) | Supabase/Firebase |
| Payments (ready) | Stripe |
| AI | Google Gemini |

---

## Source Directory Overview

| Directory | Purpose |
|-----------|---------|
| src/components/ | React UI components (100+) |
| src/contexts/ | React Context providers |
| src/data/ | Static data (track intelligence) |
| src/docs/ | Algorithm methodology documentation |
| src/help/ | Help content |
| src/hooks/ | Custom React hooks (26) |
| src/legal/ | Legal content |
| src/lib/ | Core business logic (parser, scoring, betting) |
| src/services/ | Service layer (AI, auth, payments, storage, analytics) |
| src/styles/ | CSS stylesheets |
| src/types/ | TypeScript type definitions |
| src/utils/ | Utility functions |
| src/workers/ | Web Workers |

**Do NOT include detailed file trees. Use snapshot prompts for current file state.**

---

## Key Systems

| System | Description |
|--------|-------------|
| Scoring Engine | 331-point base + ±40 overlay (see ALGORITHM_REFERENCE.md) |
| DRF Parser | 1,435 field parser with Web Worker |
| Betting System | Tier classification, Kelly sizing, exotic calculators |
| Track Intelligence | 42 tracks with bias/par data |
| AI Analysis | 5-bot system for race analysis |
| Multi-Race | Pick 3/4/5/6 support |
| Value Detection | Market inefficiency identification |
| Bet Mode | Day planning workflow |
| Live Viewer | Session sharing |

---

## Enterprise Quality Standards

**All Code Must:**
- Have error handling (try/catch with logging)
- Validate/sanitize external inputs
- Include corresponding test file for new modules
- Use logging service, not console.log in production
- Have explicit TypeScript types (no `any`)
- Handle async failure states
- Be wrapped in ErrorBoundary or handle errors gracefully
- Pass TypeScript strict mode
- Follow existing codebase patterns

**Pull Request Checklist:**
- [ ] `npm test` passes (0 failures)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No console.log statements (except logging service)
- [ ] New functions have error handling
- [ ] New modules have test coverage
- [ ] Follows existing patterns in codebase

---

## Component Creation Template

When creating new React components, follow this structure:

**File Location:** `src/components/[ComponentName].tsx`

**Standard Structure:**
```tsx
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ComponentNameProps {
  // Explicit prop types, no `any`
}

/**
 * Brief description of component purpose.
 */
export function ComponentName({ prop1, prop2 }: ComponentNameProps): React.ReactElement {
  // Implementation
  return (
    <div className="component-name">
      {/* Content */}
    </div>
  );
}

// Wrap in ErrorBoundary for major components
export function ComponentNameWithBoundary(props: ComponentNameProps): React.ReactElement {
  return (
    <ErrorBoundary>
      <ComponentName {...props} />
    </ErrorBoundary>
  );
}
```

**Required for New Components:**
- [ ] Props interface with explicit types
- [ ] JSDoc comment describing purpose
- [ ] ErrorBoundary wrapper (major components)
- [ ] Corresponding test file: `src/components/__tests__/[ComponentName].test.tsx`
- [ ] Mobile-first styling (375px base)
- [ ] Uses design system tokens only

---

## Design System Constants

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

### Spacing

- 8px grid — all margins/padding multiples of 8
- Tabular numbers (`font-variant-numeric: tabular-nums`) for all data

---

## Prompt Format

Every prompt sent to Claude Code must follow this structure:

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

PART 2 - [CATEGORY]:

3. Specific requirement
4. Specific requirement

---

DO NOT DO ANY OF THE FOLLOWING:

- Do not modify files outside [specific directories]
- Do not change [specific files that are working]
- [Task-specific constraints]

---

IF BLOCKED:

- If [specific scenario], then [specific action]

---

COMPLETION REPORT:

1. Files created (full paths)
2. Files modified (full paths)
3. What each change does
4. Issues encountered
```

### Formatting Rules

1. Entire prompt in ONE code block — One-click copy
2. Plain text inside — No markdown formatting within the code block
3. Numbered requirements — Easy reference
4. Full file paths — Always from project root
5. Specific values — "100ms" not "fast", "#19abb5" not "teal"
6. MASTER_CONTEXT.md + ALGORITHM_REFERENCE.md always first — In every reference file list

---

## Session Protocols

### Claude Chat Protocol

1. Search last 3-5 conversations about this app at session start
2. Retrieve context without asking permission
3. Generate prompts for Claude Code
4. Never write code directly

### Claude Code Protocol

1. Read MASTER_CONTEXT.md and ALGORITHM_REFERENCE.md first
2. Execute prompts as provided
3. Follow existing patterns in codebase
4. Provide completion reports

---

## Snapshot Prompt Template

Run this at the start of any Claude Chat session when codebase state is unclear or after significant changes.

```
TASK:
Generate a technical snapshot of the current codebase state.

CONTEXT:
New session needs current codebase state for accurate planning.

REFERENCE FILES TO READ FIRST:
- MASTER_CONTEXT.md
- ALGORITHM_REFERENCE.md

DEPENDENCIES:
- None

---

EXPLICIT REQUIREMENTS:

1. List all directories in src/ with purpose
2. For src/components/: List key components by category with status (COMPLETE/IN-PROGRESS/STUB)
3. For src/lib/: List modules with status (FUNCTIONAL/PARTIAL/STUB)
4. For src/services/: List services with status (WIRED/SCAFFOLDED/NOT STARTED)
5. For src/hooks/: Count and list all hooks
6. State management: List contexts, how state flows, recalculation triggers
7. PWA status: Service worker, manifest, offline capability
8. Testing status: Framework, file count, CI pipeline status
9. Known issues or tech debt: TODOs, bugs, incomplete features

---

DO NOT:
- Modify any files
- This is READ-ONLY

---

OUTPUT:
Structured snapshot document for project continuity.
```

---

## Methodology Documentation

For detailed methodology, read src/docs/ directly.

---

## Pre-UI-Session Checklist

**Before Starting UI Work:**
- [ ] `npm test` passes (0 failures)
- [ ] `npm run typecheck` passes
- [ ] `npm run dev` starts without errors
- [ ] Read MASTER_CONTEXT.md and ALGORITHM_REFERENCE.md
- [ ] Run snapshot prompt if unsure of current state
- [ ] Identify which components will be modified
- [ ] Check src/styles/ for existing design tokens
- [ ] Review related components for patterns to follow

**During UI Work:**
- [ ] Use design system colors only (see Design System Constants)
- [ ] Use 8px grid for spacing
- [ ] Use tabular numbers for data displays
- [ ] Mobile-first (375px primary target)
- [ ] 60fps animations (no jank)
- [ ] Error boundaries on new major components

---

_End of MASTER_CONTEXT.md_
