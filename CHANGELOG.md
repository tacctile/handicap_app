# Changelog

> Rolling log of significant changes. Keep last 25 entries. Oldest entries deleted when limit reached.

**Claude Code: When making significant changes, add entry at top. Delete oldest entry if >25 entries.**

---

## January 26, 2026

- All tests passing (3176 tests, 0 failures)
- Added snapshot template, quality standards, pre-UI checklist to MASTER_CONTEXT.md

## January 25, 2026

- Fixed 18 failing tests (orchestrator, AI prompts, combiner)
- Rewrote combiner tests for three-template system

## January 29, 2026

- Fixed value drift: aligned all tests, thresholds, and documentation to 336/376 ground truth
- Updated tier thresholds: Tier 1 = 181 (54%), Tier 2 = 161 (48%), Tier 3 = 131 (39%)
- Fixed comboPatterns max from 4 → 10 (v4.0)

## January 24, 2026

- Rebuilt ALGORITHM_REFERENCE.md from ground truth (336/376)
- Rebuilt MASTER_CONTEXT.md, removed stale file trees
- Deleted 7 cruft files from root
- Fixed scoringUtils.ts constants
- Fixed all src/docs/ stale values
- Fixed all runtime calculations to use 336
- Fixed all comments/JSDoc to use 336

## January 2026 (Earlier)

- AI bot system integration complete (5 bots: Trip Trouble, Pace Scenario, Vulnerable Favorite, Field Spread, Class Drop)
- Three-template system implemented (A/B/C/PASS)
- Calibration service wired
- 42 tracks with intelligence data
