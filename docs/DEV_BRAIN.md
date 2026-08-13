# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M10 — Realtime updates** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M11 — Playback state machine**
(the backend determines exactly which singer/song is active; enables the
dashboard's disabled skip/finish/pause/resume actions).

## M10 scope (plan.md §M10)

- FastAPI WebSockets: one authenticated channel per session
  (`GET /api/v1/sessions/{id}/ws`) with typed domain events.
- Events are a delivery mechanism, never the source of truth (D5): reconnecting
  clients re-fetch authoritative state.
- Frontend: participant queue screen + host dashboard subscribe; fall back to
  5 s snapshot polling while the socket is down (B13).

## Verification results (M10 acceptance criteria, plan.md §M10)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Queue changes reach connected clients almost immediately (host action → participant phone) | Verified — `QueueUpdated` (full authoritative snapshot) broadcast after submit/cancel/remove/edit; live smoke against PostgreSQL delivered `ParticipantJoined`, `SessionUpdated ACTIVE` and `SessionUpdated ENDED` over a real WebSocket |
| WebSockets are delivery only; reconnecting clients re-fetch authoritative state | Verified — frontend `useRealtime` auto-reconnects, and both screens resume REST snapshot polling while disconnected (B13); events never mutate server state |
| Typed event payloads, not free-form strings | Verified — per-event Pydantic models in `app/schemas/realtime.py`; mirrored TS types in `src/ws/client.ts` |

Additional verification:

- Backend suite: **175 passed** (163 prior + 12 new `tests/test_realtime.py`),
  `pyright` = 0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Live smoke (`websockets` client against the running server): participant and
  host streams connect with valid tokens; `ParticipantJoined`/`SessionUpdated`
  events delivered; tokenless, cross-session, and non-owner connections rejected
  (HTTP 403 on the upgrade / close 1008 in-process).
- No schema change, no new dependency (TestClient WS uses the already-present
  `websockets` via uvicorn[standard]).

## Files changed (M10)

```text
backend/app/schemas/realtime.py        (new — typed event models + RealtimeEvent union)
backend/app/realtime/__init__.py       (new — realtime delivery package)
backend/app/realtime/hub.py            (new — in-process RealtimeHub, decision D42)
backend/app/api/routes/realtime.py     (new — WS endpoint + host/participant binding)
backend/app/main.py                    (include the realtime router)
backend/app/services/queue.py          (cancel/remove now return the entry for publishing)
backend/app/api/routes/entries.py      (_build_snapshot shared by REST+realtime; publish
                                        QueueUpdated on submit/cancel/remove/edit)
backend/app/api/routes/join.py         (publish ParticipantJoined on register)
backend/app/api/routes/sessions.py     (publish SessionUpdated on start/end)
backend/tests/test_realtime.py         (new — 12 tests: auth/binding + event fan-out)
frontend/src/ws/client.ts              (new — typed realtime client + event parsing)
frontend/src/ws/useRealtime.ts         (new — subscribe/reconnect hook)
frontend/src/features/queue/QueueScreen.tsx        (realtime + fallback polling)
frontend/src/features/host/HostDashboardScreen.tsx (realtime + fallback polling)
frontend/vite.config.ts                (proxy websocket: ws: true)
docs/PROJECT_BRAIN.md                  (M10 milestone, decisions, limitations, structure)
docs/ARCHITECTURE.md                   (backend layout + realtime section + milestone list)
docs/DECISIONS.md                      (D42 realtime decision; open question resolved)
docs/API_CONTRACT.md                   (§8 Realtime marked implemented with payloads)
docs/RUNBOOK.md                        (M10 verification section)
```

## Implementation notes (M10)

- **One socket, two audiences:** both the participant queue screen and the host
  dashboard subscribe to the same per-session channel. The bearer token is
  passed as a `token` query parameter (the browser WebSocket API cannot set
  headers) and must belong to the session — a participant token must be bound
  to it, a host token must own it (decision D42, no existence leak per D29).
- **Delivery only (D5):** `QueueUpdated` carries the full authoritative
  `QueueSnapshotResponse`, so every subscriber renders exactly the state the
  REST snapshot returns. The hub is in-process and per-worker (D9 — no Redis);
  a shared hub becomes necessary only if the backend ever runs >1 worker.
- **Only real producers emit:** M10 emits `QueueUpdated` (submit/cancel/remove/
  edit), `ParticipantJoined` (join), and `SessionUpdated` (start/end). The other
  events in API_CONTRACT §8 (`SingerStarted`, `RoundCompleted`, `SessionPaused`,
  …) are not emitted until their milestones create the code paths (M11/M13/
  M14/M16) — no dead event plumbing.
- **Frontend:** `src/ws/useRealtime.ts` auto-reconnects with a 3 s delay; while
  disconnected both screens poll the authoritative snapshot every 5 s (B13).
  `QueueUpdated` replaces the snapshot state directly; `SessionUpdated` syncs the
  status badge / ended banner without a refetch.
- **No scope creep:** no new dependencies (reused the existing `websockets`
  transitively available via uvicorn[standard] for TestClient), no schema
  change, no Redis.

## Tests added (M10)

- `tests/test_realtime.py` (12 tests): token required; unknown token rejected;
  participant from another session rejected; unknown session rejected; host who
  does not own the session rejected; `QueueUpdated` on submit / cancel / host
  remove / host edit; `ParticipantJoined` on register; `SessionUpdated` on
  start / end.

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
determine exactly which singer/song is active (plan.md §M11). Then the host
dashboard's skip/finish/pause/resume actions (currently disabled, D40) and the
corresponding `SingerStarted`/`SingerFinished`/`SingerSkipped` realtime events
become implementable.
