# Known Limitations

> What doesn't work yet or has constraints. Update as limitations are resolved.

## Not Yet Implemented

| Feature        | Status      | Notes                                                |
| -------------- | ----------- | ---------------------------------------------------- |
| Service Worker | NOT STARTED | PWA manifest exists, offline caching not implemented |
| Live Odds Feed | NOT STARTED | Manual odds entry only                               |

## Current Constraints

| Constraint         | Details                                            |
| ------------------ | -------------------------------------------------- |
| Offline Capability | Manifest only, no service worker caching           |
| AI Analysis        | Intentionally disabled (code preserved for future) |

## Resolved Limitations

| Feature             | Resolution Date | Notes                         |
| ------------------- | --------------- | ----------------------------- |
| Scoring Value Drift | Jan 29, 2026    | All values aligned to 336/376 |
| Test Failures       | Jan 26, 2026    | All 3176 tests passing        |

---

Update this document when:

- A limitation is resolved (move to Resolved)
- A new limitation is discovered
- Status changes (NOT STARTED → SCAFFOLDED → WIRED)
