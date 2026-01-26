# Known Limitations

> What doesn't work yet or has constraints. Update as limitations are resolved.

## Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Service Worker | NOT STARTED | PWA manifest exists, offline caching not implemented |
| Real Authentication | SCAFFOLDED | Returns mock, Supabase/Firebase ready |
| Real Payments | SCAFFOLDED | Returns mock, Stripe ready |
| Live Odds Feed | NOT STARTED | Manual odds entry only |
| Performance Monitoring | SCAFFOLDED | DataDog/NewRelic ready but not wired |

## Current Constraints

| Constraint | Details |
|------------|---------|
| Offline Capability | Manifest only, no service worker caching |
| Auth Provider | Mock implementation, no real user accounts |
| Payment Processing | Mock implementation, no real transactions |
| AI Analysis | Requires online connection + Gemini API key |

## Resolved Limitations

| Feature | Resolution Date | Notes |
|---------|-----------------|-------|
| Scoring Value Drift | Jan 24, 2026 | All values aligned to 331/371 |
| Test Failures | Jan 26, 2026 | All 3176 tests passing |

---

Update this document when:
- A limitation is resolved (move to Resolved)
- A new limitation is discovered
- Status changes (NOT STARTED → SCAFFOLDED → WIRED)
