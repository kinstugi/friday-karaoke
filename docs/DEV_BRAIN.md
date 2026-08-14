# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M16 — Round lifecycle cleanup + summaries** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M17 — Security + abuse protection**
(request validation, rate limiting, input length limits, token hygiene, abuse
protection for the public QR flow).

## M16 scope (plan.md §M16, revised at M10.1)

- **Absent-participant cleanup:** a participant who has left no longer occupies
  future-round slots after the configured cleanup window (M16/D48).
- **Round/session summaries:** rounds played + per-participant song counts for
  the projector dashboard and the end-of-night wrap-up.
- **End-of-night flow:** sessions already run multiple rounds without recreating
  the QR code (M10.1/M13).

## Verification results (M16 acceptance criteria, plan.md §M16)

| Acceptance criterion | Result |
| -------------------- | ------ |
| A participant who has left no longer occupies a future-round slot after the configured cleanup window | Verified — participants carry `last_connected_at` (join + each realtime connect); stale participants' remaining `WAITING` entries are cancelled when the authoritative snapshot is built (`KARAOKE_ABSENT_PARTICIPANT_CLEANUP_SECONDS`, default 30 min); `test_absent_participant_entries_are_cleaned`, `test_ws_connect_refreshes_last_connected_at`, `test_cleanup_does_not_run_for_created_session` |
| The host dashboard shows the active round and a per-participant song count | Verified — the snapshot carries `round_number`, `rounds_completed`, and `participants` (remaining counts); the dashboard queue rows show "· N more" and the queue heading shows "Round N (M completed)"; `test_snapshot_reports_rounds_completed_and_participants` |
| A session runs multiple rounds without recreating the QR code | Verified — already true (M10.1 round-robin + auto-advance); regression-covered by the existing round tests |

Additional verification:

- Backend suite: **223 passed** (216 prior + 7 new `tests/test_rounds.py`),
  `pyright` 0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Migration `0007_participant_cleanup` applied to live PostgreSQL (no drift);
  `alembic current` at head.
- Live smoke against real PostgreSQL + real YouTube metadata: snapshot
  `participants` (Alice/Bob, 1 song each) + `rounds_completed` 0; the host-only
  `GET /sessions/{id}/summary` returns per-participant submitted/sung/remaining
  (participant token → 401); after one song, `songs_sung` increments.

## Files changed (M16)

```text
backend/alembic/versions/0007_participant_cleanup.py  (new — participants.last_connected_at)
backend/app/core/config.py            (absent_participant_cleanup_seconds = 1800)
backend/.env.example                  (+ the new setting)
backend/app/models/participant.py     (last_connected_at)
backend/app/services/participant.py   (register sets last_connected_at)
backend/app/api/routes/realtime.py    (participant connect refreshes last_connected_at; clean
                                       actor resolution refactor)
backend/app/services/queue.py         (cleanup_absent_participants + rounds_completed +
                                       participant_summaries + session_summary)
backend/app/schemas/queue.py          (QueueParticipant; snapshot rounds_completed/participants)
backend/app/schemas/session.py        (SessionParticipantSummary + SessionSummaryResponse)
backend/app/api/routes/sessions.py    (GET /sessions/{id}/summary, host-only)
backend/tests/test_rounds.py          (new — 7 tests)
frontend/src/api/types.ts             (QueueParticipant, SessionSummary types; snapshot fields)
frontend/src/api/host.ts              (fetchSessionSummary)
frontend/src/features/host/HostDashboardScreen.tsx (queue rows show "· N more"; heading shows
                                       "Round N (M completed)")
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/API_CONTRACT.md,
docs/RUNBOOK.md, docs/DECISIONS.md (D48)
```

## Implementation notes (M16)

- **Presence signal (D48):** `participants.last_connected_at` is set at join and
  refreshed on each realtime connect (the participant's phone keeps the socket
  open while watching the queue). NULL means "never tracked" (treated as
  present — never cleaned), which safely covers any pre-M16 rows.
- **Lazy cleanup (D48):** `QueueService.cleanup_absent_participants` runs at the
  top of `snapshot` (so every render — the public GET, every `QueueUpdated`
  broadcast, every playback endpoint — sees a clean queue). It only acts on
  `ACTIVE`/`PAUSED` sessions and only cancels `WAITING` entries (absent
  `NEXT`/`SINGING` singers stay the host's skip call). Idempotent and cheap when
  nobody is stale.
- **Summaries:** the snapshot carries `rounds_completed` (rounds below the
  derived active round) and `participants` (remaining counts, in stable
  participant order). The host-only `GET /sessions/{id}/summary` returns
  submitted/sung/remaining per participant for the wrap-up.
- **Frontend:** the dashboard queue rows show "· N more" when a participant has
  songs beyond their current one, and the queue heading shows the completed-
  rounds count. No extra request needed for the round display (the snapshot
  carries it).
- **No scope creep:** no background sweep task (D48), no new polling, no
  notification changes, no schema change beyond `0007`.

## Tests added (M16)

- `tests/test_rounds.py` (7): stale participant's entries cleaned (active
  session); recently-connected participant not cleaned; cleanup skipped for
  CREATED sessions; WS connect refreshes `last_connected_at`; snapshot
  `rounds_completed`/`participants` (including round auto-advance); the summary
  endpoint's counts + songs-sung updates; summary auth (401 no auth / 401
  participant / 404 other host).

## Current blockers

- None.

## Unresolved technical questions

- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` is in-process/per-worker (D42): a multi-worker deployment needs
  a shared hub (Redis) — tracked for M20 deployment.
- Web Push deferred to the PWA milestone (M19) — documented in DECISIONS.
- The lazy cleanup writes on the public snapshot GET (documented in D48): the
  write is idempotent and only fires when stale participants exist, so it is not
  a meaningful DoS surface at school scale (revisited in M17 if needed).

## Next recommended task

**M17 — Security + abuse protection** (backend): request validation, rate
limiting, input length limits, token hygiene, and abuse protection for the
public QR join flow (PRODUCT_SPEC §M17 / plan.md §M17) — e.g. joining/submission
rate limits, preview-call throttling (YouTube API quota), and bounds checks.
