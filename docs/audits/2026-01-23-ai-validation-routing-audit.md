# AI Validation Routing Audit

**Date:** 2026-01-23
**Branch:** claude/debug-ai-validation-routing-PoeUs
**Issue:** Template A showing 37 races (33%) when expected 0%

## Summary

**Finding:** The validation script IS correctly using the AI service functions. No bug found.

**Root Cause:** The reported 33% Template A / 3.6% PASS was from a validation run BEFORE commit `b4bcf31` (rewire confidence tiers) was merged. The current code is working correctly.

## Verification Results (20-race sample)

| Template   | Count | Percentage |
| ---------- | ----- | ---------- |
| PASS       | 18    | 90%        |
| Template C | 2     | 10%        |
| Template A | 0     | **0%**     |
| Template B | 0     | 0%         |

## Validation Flow Trace

The validation script correctly routes through the AI service:

```
scripts/validate-ai-architecture.ts:954
  └─> getMultiBotAnalysis()
        └─> combineMultiBotResults() [index.ts:362]
              └─> buildTicketConstruction() [index.ts:2530]
                    ├─> identifyValueHorse() [index.ts:2236]
                    └─> selectTemplate() [index.ts:2259]
```

## Key Function Logic (src/services/ai/index.ts)

`selectTemplate()` at lines 1632-1676:

1. WIDE_OPEN field → Template C
2. VULNERABLE favorite → Template B
3. SOLID favorite + NO value horse → **PASS** (routes to MINIMAL tier)
4. SOLID favorite + value horse → Template A (rare)

## Files Verified

- `scripts/validate-ai-architecture.ts` - Correctly imports `getMultiBotAnalysis`
- `src/services/ai/index.ts` - Contains correct routing logic
- `.github/workflows/ai-validation.yml` - Runs fresh validation

## Conclusion

No code changes required. The validation script is a single source of truth that correctly uses the AI service functions. The reported Template A percentage was from stale results.

## Next Steps

1. Run full validation when API rate limits reset
2. Verify Template A = 0% across all 111 races
3. Monitor PASS rate (currently ~90%, may need tuning if too aggressive)
