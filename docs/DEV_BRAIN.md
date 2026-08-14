# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M18 — Testing + failure scenarios** — COMPLETE (verified).

## Current task

**Queue-model revision (post-M18, from real-pilot feedback) — IMPLEMENTED + locally verified, NOT deployed.**

The queue now orders each round by **join order** (earliest join first, via
`participants.created_at` with a microsecond Python default), the host can
**re-order the current round** (`PATCH/DELETE /api/v1/sessions/{id}/order`,
per-round via a `round_orders` table — the next round resets to join order), and
**skip moves the singer to the end of the round** (`queue_entries.skip_count`,
one re-chance; excluded only when they are the only non-terminal entry left).
Migration `0008_queue_ordering` applied locally; suite **256 passed**; pyright 0;
frontend up/down + reset controls on the dashboard; local live smoke verified
join-order-wins, reorder, skip-to-end, and reset. **Deployment to Cloud Run is
deferred until the user has tested locally.** Decisions D43/D20 carry revision
notes. Next milestone: **M19 — PWA + mobile UX** (web manifest, installable PWA,
service worker, offline/reconnect handling — where the deferred Web Push can also
land).

## M18 scope (plan.md §M18)

Formalize the behavioral + integration + concurrency test matrix. Most behaviors
were already covered by the endpoint suite; M18 adds the **concurrency and
failure-scenario** tests that were missing: rapid-submission determinism, the
find-or-create races, single-transition guarantees under host intervention, the
E21 cancel-vs-remove race in both directions, and host/participant reconnect
recovery.

## Verification results (M18, plan.md §M18 — matrix)

| Area | Result |
| ---- | ------ |
| Queue ordering (deterministic) | Verified — `test_two_participants_submit_rapidly_are_ordered` (burst of three submissions → stable order + positions 1–3) |
| Find-or-create race handling | Verified — duplicate songs share one `YouTubeVideo` row (`test_rapid_duplicate_submits_share_one_video_row`); lazy rounds are created once and reused (`test_rapid_second_submits_reuse_the_same_future_round`); the race path (a concurrent winner already inserted the row) is handled (`test_find_or_create_video_uses_existing_row`, `test_find_or_create_round_uses_existing_round`) |
| Skip / finish / remove / cancel semantics | Verified — `test_skip_during_countdown_is_not_possible` (nothing singing → 409); E21 both directions: participant-cancel-then-host-remove no-ops (M14) and host-remove-then-participant-cancel is rejected with the state preserved (`test_host_remove_then_participant_cancel_ends_valid`) |
| "Only one valid transition" (host skip/advance during automation) | Verified — `test_advance_twice_yields_a_single_transition`: with cooldown 0, `end` enters COUNTDOWN directly and the first advance auto-starts with exactly one entry `SINGING`; a second advance is a 409 no-op |
| Reconnect recovery (host + participant, D18/D5/E8/E11) | Verified — `test_host_reconnect_recovers_playback_state` (fresh fetches show ACTIVE + PLAYING + SINGING after a browser close); `test_participant_reconnect_recovers_identity_and_queue` (stored token re-fetches the participant's entries and reconnects to the realtime channel) |
| Integration (session creation, joining, submission, moderation, authorization, persistence) | Verified — covered by the existing suite (test_sessions/test_join/test_queue/test_playback/test_rounds) |

Additional verification:

- Backend suite: **240 passed** (230 prior + 10 new `tests/test_concurrency.py`),
  `pyright` 0 errors. No code changes in M18 (tests only) — none of the new
  tests surfaced a bug in the find-or-create/transition/race logic.
- Frontend unchanged; typecheck/lint/build still green.
- Note: true *simultaneous* requests cannot run against the in-memory SQLite
  test engine (StaticPool shares one connection), so "simultaneous" is exercised
  as rapid sequential requests — the backend serializes them, which is the
  observable contract. True multi-connection concurrency is exercised only
  against PostgreSQL (deployment, M20).

## Files changed (M18)

```text
backend/tests/test_concurrency.py     (new — 10 tests)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/RUNBOOK.md
```

## Implementation notes (M18)

- **Concurrency semantics:** the tests assert the *observable* contract (rapid
  sequential requests are serialized deterministically) and exercise the
  find-or-create race handling directly (a pre-inserted "concurrent winner" row
  is found, not violated). The M13 frozen-clock pattern is not needed here
  (cooldown/countdown 0 sessions make transitions instant).
- **No scope creep:** M18 is tests + docs only — no new endpoints, no schema
  change, no new dependencies, no production-code edits.

## Tests added (M18)

- `tests/test_concurrency.py` (10): rapid submissions ordered; duplicate songs
  share one video row; second songs share one round; find-or-create video race;
  find-or-create round race; advance-twice yields one transition; skip during a
  countdown is impossible; host-remove-then-cancel ends valid (E21); host
  reconnect recovers playback state; participant reconnect recovers identity +
  queue.

## Current blockers

- None.

## Unresolved technical questions

- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` + `RateLimiter` are in-process/per-worker (D42/D49): a
  multi-worker deployment needs shared state — tracked for M20.
- Web Push deferred to the PWA milestone (M19) — documented in DECISIONS.
- True concurrent-request testing needs PostgreSQL (the SQLite test engine
  serializes via StaticPool) — exercised at deployment (M20).

## Next recommended task

**M19 — PWA + mobile UX** (frontend): web manifest + installable PWA, a service
worker for offline/reconnect handling (and the deferred Web Push "you're next"
notifications via VAPID), plus mobile/offline polish (loading/error states,
QR-friendly join URL, large touch targets already in place).
