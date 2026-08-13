# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M10.1 — Queue rounds + auto-advance** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M11 — Playback state machine**
(the backend determines exactly which singer/song is active: the first
non-terminal entry of the current round; round boundaries are just another
transition).

## M10.1 scope (plan.md §M10.1)

Round-robin queue: one song per participant per round, stable participant order,
rounds auto-advance, no next-round enrollment.

## Verification results (M10.1 acceptance criteria, plan.md §M10.1)

| Acceptance criterion | Result |
| -------------------- | ------ |
| p1×3, p2×2, p3×5 → play order p1,p2,p3 / p1,p2,p3 / p1,p3 / p3 / p3 | Verified — `test_round_robin_order_and_auto_advance` (P1,P2,P3 → P1,P2 after round-1 exhaustion) plus the live smoke |
| A participant's 2nd song is invisible until every participant's 1st song is done | Verified — `test_second_song_goes_to_a_future_round` (position null, not in snapshot) |
| Stable round order; late joiners appended to the current round | Verified — `test_stable_order_repeats_across_rounds`, `test_late_joiner_appends_to_current_round` |
| Participants whose songs run out drop out automatically | Verified — round-2 snapshot omits participants with no round-2 song |
| Per-participant cap (5) enforced with a clear message | Verified — `test_submit_song_cap_conflicts` (409 "at most 5") + `test_submit_after_cancel_frees_a_song_cap_slot` |
| No `ROUND_COMPLETE`; rounds advance automatically, no enrollment | Verified — `ROUND_COMPLETE` removed from `SessionStatus` + transitions; `test_new_submission_after_full_exhaustion_starts_next_round` |
| Positions within the current round; future-round songs have no position | Verified — `test_my_entries_lists_current_and_upcoming_songs` (position null for upcoming) |

Additional verification:

- Backend suite: **184 passed** (175 prior + 9 new queue/round tests), `pyright`
  0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Live smoke against real PostgreSQL + real YouTube metadata: Alice song1 → pos 1,
  Alice song2 → pos null, Bob song1 → pos 2; snapshot round 1 = [Alice, Bob];
  my-songs = [(A, 1), (B, null)]; after the host removes the round-1 entries the
  snapshot auto-advances to round 2 = [Alice(B)].
- No schema migration: entries were already round-scoped; the change is pure
  service/query logic (D43). The `Round` table gains lazily-created later rounds.

## Files changed (M10.1)

```text
backend/app/core/config.py                    (+ KARAOKE_QUEUE_MAX_SONGS_PER_PARTICIPANT, default 5, D45)
backend/.env.example                          (+ the new setting)
backend/app/domain/session.py                 (ROUND_COMPLETE removed; CREATED->ACTIVE<->PAUSED->ENDED)
backend/app/services/queue.py                 (round-robin engine: SongLimitError, round assignment,
                                               derived active round, stable ordering, participant
                                               entries, get_current_round_number)
backend/app/schemas/queue.py                  (QueueSnapshotResponse + round_number)
backend/app/api/routes/entries.py             (submit cap -> 409; _build_snapshot + round_number;
                                               new GET /entries/mine "my songs" endpoint)
backend/app/domain/queue_entry.py             (non_terminal docstring -> per-participant cap)
backend/tests/test_queue.py                   (cap tests, round assignment/stable order/auto-advance/
                                               late joiner/round_number/my-songs tests)
backend/tests/test_sessions.py                (ROUND_COMPLETE assertions removed)
frontend/src/api/types.ts                     (QueueSnapshot.round_number; ROUND_COMPLETE dropped)
frontend/src/api/entries.ts                   (+ fetchMyEntries)
frontend/src/lib/session.ts                   (statusLabel: ROUND_COMPLETE dropped)
frontend/src/App.css                          (.badge-round replaces .badge-round_complete)
frontend/src/features/queue/QueueScreen.tsx   (round badge, "Your songs" section with cancel,
                                               one-entry-per-participant queue)
frontend/src/features/host/HostDashboardScreen.tsx (round indicator in the queue heading)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/DEV_BRAIN.md,
docs/PRODUCT_SPEC.md, docs/DOMAIN_MODEL.md, docs/API_CONTRACT.md, docs/RUNBOOK.md, plan.md
```

## Implementation notes (M10.1)

- **Round assignment (B19/D43):** a new song goes to the current round (the
  lowest-numbered round with a non-terminal entry) when the participant has no
  non-terminal entry there; otherwise to one round above their highest. When the
  queue is fully exhausted, a fresh submission starts the next numbered round —
  except on a brand-new session, where the first songs belong to round 1 (this
  was a bug caught by the tests: the first submission went to round 2).
- **Derived active round:** never stored (D8-style). `_active_round` is a single
  JOIN query; `get_active_entries` orders the current round by each participant's
  earliest submission time (`MIN(created_at)` via an aggregated subquery join),
  then `created_at`/`id`.
- **Cap:** `KARAOKE_QUEUE_MAX_SONGS_PER_PARTICIPANT` (default 5) counts the
  participant's non-terminal entries across all rounds. `ActiveEntryLimitError`
  was renamed `SongLimitError` (the "active entries in this round" limit no
  longer exists).
- **No `RoundStarted` event:** round advances are visible through
  `round_number` in the `QueueUpdated` snapshot (the mutation that empties a
  round already broadcasts it).
- **Frontend:** the participant queue screen shows a `Round N` badge and a
  "Your songs" section (current-round entry with its position + upcoming songs,
  each cancellable — cancel already worked for any own WAITING entry). The host
  dashboard queue heading shows the active round.
- **No scope creep:** no new dependencies, no schema migration, no enrollment
  prompt, no `RoundStarted` event.

## Tests added (M10.1)

- `test_queue.py` (9 new/rewritten): song cap (409 at 6th), cancel frees a cap
  slot, second song → future round (position null, invisible in snapshot),
  round-robin order + auto-advance via host removals, stable order repeats
  across rounds, late joiner appended, empty-queue round_number default,
  fresh-cycle round after full exhaustion, and the participant "my songs"
  endpoint (auth, cross-session 404, current+upcoming listing).
- `test_sessions.py`: `ROUND_COMPLETE` transition assertions removed.

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): Web Push service choice (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` is in-process/per-worker (D42): a multi-worker deployment needs
  a shared hub (Redis) — tracked for M20 deployment.

## Next recommended task

**M11 — Playback state machine** (backend): formalize the playback states
(IDLE → PREPARING → COUNTDOWN → PLAYING → COOLDOWN → …) so the backend can
determine exactly which singer/song is active — the first non-terminal entry of
the current round (M10.1). Round boundaries are just another transition. Then
the host dashboard's skip/finish/pause/resume actions (currently disabled, D40)
and the `SingerStarted`/`SingerFinished`/`SingerSkipped` realtime events become
implementable.
