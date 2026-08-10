# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M1 — Product Specification + UX** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M2 — Backend Skeleton + Database**.

## Verification results (M1 acceptance criteria)

| Acceptance criterion (plan.md §M1)                          | Result |
| ----------------------------------------------------------- | ------ |
| User flows documented clearly enough to implement without guessing | Yes — `docs/PRODUCT_SPEC.md` §5 (host), §6 (participant), detailed step-by-step with screen inventory §7 |
| Business rules documented clearly enough to implement without guessing | Yes — normative rules B1–B18 (§9) + 24 edge cases E1–E24 (§8) + playback/automation spec (§10) |
| All 17 required edge cases from plan.md covered | Yes — every one appears in the catalog (E1–E17 map 1:1; E19–E21 add the plan.md §M18 concurrency scenarios; E18/E22–E24 add robustness cases consistent with §M18) |

Coverage map (plan.md §M1 edge cases -> spec): duplicate song E1, participant
leaves E2, invalid URL E3, video unavailable E4, video unavailable after submission
E5, host removes participant E6, host edits song E7, participant refreshes E8,
participant loses internet E9, host loses internet E10, host closes browser E11,
song ends E12, host skips E13, host manually advances E14, queue empty E15,
round ends E16, no next-round answer E17.

Checks run (no code changed in M1 — documentation only):

- `uv run pytest` — 2 passed (unchanged).
- `uv run pyright` — 0 errors, 0 warnings.
- `npm run typecheck` — clean. `npm run lint` — clean.
- Confirmed on `dev`, working tree contained only the intended doc edits.

## Files changed (M1)

```text
docs/PRODUCT_SPEC.md    (new — frozen MVP behavioral contract)
docs/DECISIONS.md       (updated — M1 decisions D14–D20)
docs/PROJECT_BRAIN.md   (updated — related files, journeys pointer, milestone status)
docs/DEV_BRAIN.md       (updated, this file)
```

## Implementation notes (M1)

- M1 is a documentation milestone by design (plan.md §M1). No backend/frontend
  code was touched; the existing scaffolds are unchanged.
- The spec is deliberately concrete so later milestones (M2–M17) can implement
  without guessing: concrete defaults (active-entry limit 2, cooldown 10 s,
  countdown 20 s, nickname 1–20 chars unique per session) and deterministic rules
  (round ordering, skip vs. advance).
- Behavioral decisions were recorded in DECISIONS.md D14–D20 so the rationale is
  preserved (no silent redesign in later milestones).

## Tests added (M1)

- None (documentation milestone). The M1 acceptance criterion is document quality;
  verified via the coverage map above and cross-doc consistency.

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): host auth mechanism (M3),
  YouTube metadata source (M6), realtime payload schemas (M10), Web Push choice
  (M15). None block M2.
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.

## Next recommended task

**M2 — Backend Skeleton + Database** — FastAPI + SQLAlchemy 2.x + PostgreSQL +
Alembic + Pydantic Settings + structured logging + health endpoint + project layers
(see `plan.md` §M2). The backend layout target is in `docs/ARCHITECTURE.md` §3.
