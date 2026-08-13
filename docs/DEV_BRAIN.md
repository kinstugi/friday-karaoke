# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M13 — Automatic song transitions** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M14 — Host moderation + manual
controls** (skip/finish/pause/resume polish and the remaining host intervention
paths; much of it already landed with M11/M13).

## M13 scope (plan.md §M13)

- Automatic advancement between songs, configurable **per session**
  (PRODUCT_SPEC §10): after a song ends naturally (`play/end`), the backend runs
  `COOLDOWN → COUNTDOWN → auto-start`; host `skip`/`finish` skip the cooldown
  and go straight to the countdown (D20). The host can always override.

## Verification results (M13 acceptance criteria, plan.md §M13)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Automatic advancement is configurable per session | Verified — `cooldown_seconds`/`countdown_seconds` on session creation (defaults 10/20 from settings); `test_transition_timings_are_per_session_and_instant_path`; live smoke with 1s/1s timings |
| Song ends → cooldown → next-singer preparation → countdown → next song | Verified — `test_advance_moves_cooldown_then_countdown_then_auto_start` (frozen clock); live smoke showed COOLDOWN (0.98s remaining) → COUNTDOWN → PLAYING auto-start of the next singer |
| Host can always skip / finish / pause / manually start | Verified — `skip`/`finish` begin the countdown (skipping the cooldown, D20); `test_manual_start_cancels_pending_transition`; `test_pause_cancels_pending_transition`; manual start cancels the transition (B9) |

Additional verification:

- Backend suite: **207 passed** (199 prior + 8 new transition tests), `pyright`
  0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Migration `0006_playback_transitions` applied to live PostgreSQL (no drift);
  `alembic current` at head.
- Live smoke against real PostgreSQL + real YouTube metadata: per-session 1s/1s
  timings; start → PLAYING; end → COOLDOWN (remaining ~0.98s); advance before
  the deadline → 409; advance → COUNTDOWN; advance → PLAYING (next singer
  auto-started); realtime delivered `SingerStarted` + `QueueUpdated` on start and
  `SingerFinished` + `QueueUpdated` on end.

## Files changed (M13)

```text
backend/alembic/versions/0006_playback_transitions.py  (new — sessions.playback_state,
                                       transition_until, cooldown_seconds, countdown_seconds)
backend/app/core/config.py            (post_song_cooldown_seconds=10, next_singer_countdown_seconds=20)
backend/.env.example                  (+ the two settings)
backend/app/models/session.py         (the four new columns)
backend/app/schemas/session.py        (create request + response carry the timings/state)
backend/app/services/session.py       (create persists per-session timings)
backend/app/domain/playback.py        (transition_states + ensure_utc helper; stored-state doc)
backend/app/services/playback.py      (end/advance + transitions; stored state; start cancels;
                                       pause cancels; finish/skip begin the countdown)
backend/app/services/queue.py         (snapshot reads stored state + transition deadline/remaining)
backend/app/schemas/queue.py          (QueueSnapshotResponse + transition_until/
                                       transition_remaining_seconds)
backend/app/api/routes/playback.py    (+ /play/end, /play/advance; pause/resume broadcast
                                       QueueUpdated too)
backend/app/api/routes/sessions.py    (create passes timings; response maps the new fields)
backend/tests/test_playback.py        (updated finish/skip semantics + 8 new transition tests)
frontend/src/api/types.ts             (QueueSnapshot.transition_until/transition_remaining_seconds)
frontend/src/api/host.ts              (endPlayback, advancePlayback)
frontend/src/lib/transition.ts        (new — useTransitionRemaining hook)
frontend/src/features/host/HostDashboardScreen.tsx (player onEnded -> play/end; countdown + auto-advance;
                                       advance 409 tolerated; transition note in Playback card)
frontend/src/features/queue/QueueScreen.tsx (next-singer countdown on the Up next card)
frontend/src/App.css                  (.transition-note)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DECISIONS.md (D46 superseded, D47), docs/DEV_BRAIN.md,
docs/API_CONTRACT.md, docs/RUNBOOK.md, docs/PRODUCT_SPEC.md (§10 note)
```

## Implementation notes (M13)

- **Stored state (D47):** `sessions.playback_state` is now authoritative
  (supersedes M11/D46's derivation — the transition phases have no `SINGING`
  entry). The service keeps state and entry statuses consistent
  (`PLAYING` ⇔ `SINGING`; `COOLDOWN`/`COUNTDOWN` ⇔ front is `NEXT`; `IDLE` ⇔
  nothing). `play/end` marks `COMPLETED` and starts `COOLDOWN`; `skip`/`finish`
  mark `SKIPPED`/`COMPLETED` and start `COUNTDOWN` (skip the cooldown, D20);
  `play/advance` progresses a phase whose deadline passed (`COOLDOWN`→`COUNTDOWN`,
  then auto-promote `NEXT`→`SINGING`). `play/start` cancels a pending transition
  (host override, B9); `play/pause` cancels it too (E22).
- **Authoritative deadlines, no background timers (D47):** the snapshot carries
  `transition_until` + `transition_remaining_seconds`; the dashboard counts down
  via `useTransitionRemaining` and calls `play/advance` at zero (a stale 409 from
  another tab or a just-advanced state is tolerated silently). A reopened tab
  with an overdue deadline self-recovers on the next read.
- **Per-session config:** `SessionCreateRequest` accepts `cooldown_seconds`/
  `countdown_seconds` (defaults from settings); `SessionResponse` exposes them.
- **Migration:** `0006_playback_transitions` adds four columns with server
  defaults; existing sessions read `IDLE`/10/20 with no transition pending.
- **Timezone portability (D22):** SQLite reads `DateTime(timezone=True)` back
  naive; `ensure_utc` normalizes before comparisons/subtractions so tests and
  PostgreSQL agree.
- **No scope creep:** no notifications (M15), no round summaries (M16), no
  new dependencies.

## Tests added (M13)

- `tests/test_playback.py` (8 new): natural end begins COOLDOWN; advance moves
  COOLDOWN → COUNTDOWN → auto-start (frozen clock, with 409s before each
  deadline); advance with no transition → 409; manual start cancels the pending
  transition; pause cancels it; end with no next returns IDLE; per-session
  timings + the instant path (cooldown/countdown 0); realtime Singer events on
  end and on auto-start. Existing finish/skip tests updated to the M13 countdown
  semantics.

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
- Client/server clock skew during a countdown could cause a transient 409 on
  `play/advance`; the dashboard tolerates it and re-syncs from the snapshot
  (negligible on NTP-synced school devices).

## Next recommended task

**M14 — Host moderation + manual controls**: with M11/M13 the primary controls
(start/skip/finish/pause/resume) are already live; M14 covers the remaining host
authority paths (PRODUCT_SPEC §5.5/§9): removing the current singer advances
playback, editing a URL keeps the position (already true), and general polish of
the moderation surface — then **M15** adds the "you're next" notifications on top
of the M13 countdown (on NEXT and at countdown start).
