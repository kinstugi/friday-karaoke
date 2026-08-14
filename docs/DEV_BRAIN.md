# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M15 — Next-singer notifications** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M16 — Round lifecycle cleanup +
summaries** (absent-participant cleanup, round/session summaries for the host).

## M15 scope (plan.md §M15)

- In-app "you're next" notifications delivered over the realtime channel and
  rendered on the participant queue screen (PRODUCT_SPEC §11): when an entry is
  promoted to `NEXT` and again at countdown start (timing configurable, §10).
- Web Push is **deferred** (needs the M19 service worker + VAPID credentials) —
  the school pilot's participants watch the queue screen live, so in-app is the
  MVP notification (DECISIONS open question resolved).

## Verification results (M15 acceptance criteria, plan.md §M15)

| Acceptance criterion | Result |
| -------------------- | ------ |
| The next participant receives a clear notification | Verified — a typed `NextSingerNotified` event (payload: entry, participant, title, channel, phase) is broadcast on `NEXT` promotion (phase `next`) and on countdown start (phase `countdown`); the participant queue screen renders a "🎤 You're next! Get ready: <song> — <channel>" banner filtered to the participant's nickname, auto-dismissed after 8s |
| Notification timing is configurable | Verified — the countdown-start notification rides the per-session `countdown_seconds` (M13); the `next` phase fires when the previous song ends |
| In-app first, then Web Push | Verified — Web Push explicitly deferred and documented (DECISIONS open question resolved) |

Additional verification:

- Backend suite: **216 passed** (212 prior + 4 new notification tests), `pyright`
  0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Live smoke against real PostgreSQL + real YouTube metadata: Alice's song ends
  → Bob's participant WebSocket received `NextSingerNotified` phase `next`
  ("Rick Astley - Never…"); after the cooldown, `play/advance` → phase
  `countdown`. The event is broadcast to all subscribers and filtered
  client-side on the participant's nickname.

## Files changed (M15)

```text
backend/app/schemas/realtime.py      (NextSingerNotifiedEvent + union; docstring)
backend/app/api/routes/playback.py   (_notify_next_singer helper; end/skip/finish/advance
                                      broadcast the notification)
backend/app/api/routes/entries.py    (host removal of the current singer also notifies
                                      the next singer)
backend/tests/test_playback.py       (4 notification WS tests; the M13 auto-start test
                                      updated for the extra end events)
frontend/src/ws/client.ts            (NextSingerNotifiedEvent type + parse)
frontend/src/features/queue/QueueScreen.tsx (banner: filter by nickname, auto-dismiss 8s)
frontend/src/App.css                 (.notify banner style)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/API_CONTRACT.md,
docs/RUNBOOK.md, docs/DECISIONS.md (Web Push open question resolved), docs/PRODUCT_SPEC.md (§11)
```

## Implementation notes (M15)

- **Delivery:** a typed `NextSingerNotifiedEvent` is broadcast to every
  subscriber of the session (the hub is not per-participant targeted); the
  participant queue screen filters on `participant_name === identity.nickname`.
  The event is delivery-only (D5): the banner is ephemeral UI and the
  authoritative state remains the snapshot.
- **Moments:** phase `next` fires on `NEXT` promotion (the previous song ended /
  host skip / host finish / host removal of the singer); phase `countdown` fires
  when the countdown transition begins (immediately on skip/finish/removal, or
  after the cooldown via `play/advance`). With a cooldown, the two phases are
  ~`cooldown_seconds` apart; without one they arrive together (the banner simply
  shows the latest message).
- **Frontend:** the banner auto-dismisses after 8 s (timer cleared on a new
  notification and on unmount); the Up-next card's live countdown (M13) remains
  the persistent "starts in Ns" display.
- **No scope creep:** no Web Push/service worker/VAPID (deferred to the PWA
  milestone), no new dependencies, no schema change.

## Tests added (M15)

- `tests/test_playback.py` (4): `end` broadcasts `next`; `finish` broadcasts
  both `next` + `countdown`; `advance` (cooldown → countdown) broadcasts
  `countdown`; host removal of the singer broadcasts both phases. The M13
  auto-start WS test was updated for the additional `end` events.

## Current blockers

- None.

## Unresolved technical questions

- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` is in-process/per-worker (D42): a multi-worker deployment needs
  a shared hub (Redis) — tracked for M20 deployment.
- Web Push (service worker + VAPID) is deferred from M15 to the PWA milestone
  (M19) — documented in DECISIONS.

## Next recommended task

**M16 — Round lifecycle cleanup + summaries** (backend + frontend): the revised
milestone from M10.1 — absent-participant cleanup (a disconnected/absent
participant should not silently keep future-round slots forever), and round/
session summaries surfaced to the host (rounds played, per-participant song
counts, remaining lists). The round-robin engine and automatic transitions are
already live (M10.1/M13); this milestone completes the round concept.
