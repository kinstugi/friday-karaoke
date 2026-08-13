# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M11 — Playback state machine** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M12 — YouTube host player** (embed
the YouTube player in the host dashboard; the host browser is the playback
device). M13 (automatic transitions) and M15 (next-singer notifications) build
on the M11 playback engine.

## M11 scope (plan.md §M11)

- Formalize playback behavior: the backend determines exactly which singer/song
  is active — the first non-terminal entry of the current round (M10.1) — and
  round boundaries are just another transition.
- Host-driven playback endpoints (start/skip/finish/pause/resume) that enable the
  dashboard's previously-disabled Skip/Finish/Pause/Resume buttons (D40).
- Entry status lifecycle: WAITING -> SINGING (start), -> NEXT (advance),
  -> COMPLETED/SKIPPED (finish/skip, D20).

## Verification results (M11 acceptance criteria, plan.md §M11)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Backend can determine exactly which singer/song is active (first non-terminal of the current round) | Verified — `PlaybackService` operates on `queue_service.get_active_entries` (stable order, M10.1); `test_start_promotes_first_entry_and_derives_playing` |
| Round boundaries are just another transition (auto-advance into the next round) | Verified — `test_round_advances_after_finishing_last_entry` (finish of round 1's last entry → round 2 active, next entry `NEXT`) |
| Host can interrupt transitions (skip/finish/pause/resume) | Verified — skip→SKIPPED, finish→COMPLETED (D20); pause ACTIVE→PAUSED, resume PAUSED→ACTIVE; 409s for invalid actions |

Additional verification:

- Backend suite: **199 passed** (184 prior + 15 new `tests/test_playback.py`),
  `pyright` 0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass; the
  dashboard's Skip/Finish/Pause/Resume buttons are now live (disabled only when
  the action is invalid, with an explanatory `title`), and the Playback card
  shows the derived playback state.
- Live smoke against real PostgreSQL + real YouTube metadata: start → PLAYING
  [SINGING, WAITING]; realtime delivered `SingerStarted` + `QueueUpdated`;
  finish → IDLE [NEXT]; skip → empty; pause before session start → 409; pause →
  PAUSED; resume → ACTIVE.
- No schema migration (playback state is derived, D46).

## Files changed (M11)

```text
backend/app/domain/playback.py             (new — PlaybackState enum, full documented lifecycle)
backend/app/services/playback.py           (new — PlaybackService: start/skip/finish, NEXT
                                            promotion, ended-session guard)
backend/app/services/session.py            (pause/resume session transitions ACTIVE<->PAUSED)
backend/app/services/queue.py              (entry_response + snapshot helpers incl. derived
                                            playback_state, shared by REST + realtime + playback)
backend/app/schemas/queue.py               (QueueSnapshotResponse + playback_state)
backend/app/schemas/realtime.py            (SingerStarted/SingerFinished/SingerSkipped events)
backend/app/api/routes/playback.py         (new — /play/start|skip|finish|pause|resume, host-only)
backend/app/api/routes/entries.py          (use queue_service.snapshot/entry_response)
backend/app/main.py                        (include playback router)
backend/tests/test_playback.py             (new — 15 tests)
frontend/src/api/types.ts                  (PlaybackState type; QueueSnapshot.playback_state)
frontend/src/ws/client.ts                  (Singer* event types + parse)
frontend/src/api/host.ts                   (startPlayback/skipPlayback/finishPlayback/pausePlayback/resumePlayback)
frontend/src/features/host/HostDashboardScreen.tsx (live playback action bar, Playback card,
                                            playbackLabel)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DECISIONS.md (D46), docs/DEV_BRAIN.md,
docs/API_CONTRACT.md, docs/RUNBOOK.md, docs/PRODUCT_SPEC.md
```

## Implementation notes (M11)

- **Derived playback state (D46):** no stored column. `PLAYING` iff an entry is
  `SINGING`, else `IDLE`. The `PlaybackState` enum carries the full documented
  lifecycle; PREPARING/COUNTDOWN/COOLDOWN become reachable when M13 adds timers.
- **Entry lifecycle:** `play/start` promotes the front of the active queue to
  `SINGING`; `play/skip`/`play/finish` mark it `SKIPPED`/`COMPLETED` and promote
  the new front to `NEXT`. Because the active round is derived (D43), advancing
  past a round's last entry automatically makes the next round active — a round
  boundary is just another transition.
- **Realtime:** playback endpoints broadcast `SingerStarted`/`SingerFinished`/
  `SingerSkipped` + `QueueUpdated`; pause/resume broadcast `SessionUpdated` (the
  queue is unchanged). The snapshot is the single authoritative render source.
- **Pause/resume:** session transitions `ACTIVE -> PAUSED` / `PAUSED -> ACTIVE`
  in `SessionService` (previously defined but unreachable), exposed under
  `/play/pause` and `/play/resume`. `PAUSED` is now reachable.
- **Dashboard (D40 lifted):** the action bar wires Start-session, Start-next-song,
  Skip, Finish, Pause, Resume, End-session. Skip/Finish are disabled only while
  nothing is singing (with a `title`); Pause shows when ACTIVE, Resume when
  PAUSED. The Playback card shows the derived state.
- **No scope creep:** no host player (M12), no automation timers (M13), no
  notifications (M15), no schema change, no new dependencies.

## Tests added (M11)

- `tests/test_playback.py` (15 tests): auth (401) + ownership (404) + ended
  session (409); start with empty queue (409); start promotes first entry and
  derives PLAYING; start twice (409); skip/finish mark SKIPPED/COMPLETED and
  promote NEXT; skip/finish with nothing playing (409); round auto-advance
  across finish; pause/resume transitions + invalid-state 409s; realtime
  `SingerStarted`/`SingerSkipped` + `QueueUpdated` delivery.

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

**M12 — YouTube host player**: embed the YouTube IFrame player in the host
dashboard (the host browser is the playback device, D4), drive it from the M11
playback state (start/skip/finish), report player events (started/ended/errors)
back to the backend, and handle browser-autoplay restrictions (host must
interact before audio). M13 then wires the timer-driven automatic transitions
(PREPARING/COUNTDOWN/COOLDOWN).
