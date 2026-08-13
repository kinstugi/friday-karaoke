# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M14 — Host moderation + manual controls** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M15 — Next-singer notifications**
("You're next!" when an entry is promoted to `NEXT` and again at countdown
start — riding the M13 automatic transitions).

## M14 scope (plan.md §M14)

Make the host the final authority (PRODUCT_SPEC §5.5/§9). Most controls landed in
earlier milestones; M14 closes the remaining gap: **removing the current singer
advances playback** (E6/E5), so the host can recover from a bad live song
without database access, and removes of already-terminal entries are no-ops
(E21).

## Verification results (M14 acceptance criteria, plan.md §M14)

| Criterion | Result |
| --------- | ------ |
| Host can recover from bad submissions without database access (Remove / Edit) | Verified — Remove: `DELETE /api/v1/entries/{id}`; **removing the current `SINGING` entry advances playback** (promotes the next to `NEXT` and begins the countdown transition, E6); Edit: `PATCH .../video` re-validates + re-fetches metadata and preserves the position (E7). Live smoke confirmed both |
| Skip / manual advance / pause / resume | Verified — already live since M11/M13 (`play/skip`, `play/finish` = manual advance, `play/pause`, `play/resume`); skip/finish skip the cooldown and begin the countdown (D20) |
| Removing an already-terminal entry is a no-op (E21) | Verified — `QueueService.remove` returns the entry unchanged (status preserved, e.g. `CANCELLED` not overwritten by `REMOVED`); `test_remove_terminal_entry_is_noop` |

Additional verification:

- Backend suite: **212 passed** (208 prior + 4 new moderation tests), `pyright`
  0 errors.
- Frontend unchanged (the dashboard's Remove button already re-syncs via the
  realtime channel; the player stops and the countdown shows automatically):
  typecheck/lint/build still pass.
- Live smoke against real PostgreSQL + real YouTube metadata: start → PLAYING;
  remove the current singer → 204 → snapshot `COUNTDOWN` with the next entry
  `NEXT`; edit the NEXT entry's URL → 200 with re-fetched metadata, position
  preserved.

## Files changed (M14)

```text
backend/app/services/queue.py         (remove returns (entry, was_singing); idempotent for
                                       terminal entries, E21)
backend/app/services/playback.py      (on_singer_removed: advance playback after the current
                                       singer is removed, E6; skips cooldown like skip/finish,
                                       D20; no-op on ended sessions)
backend/app/api/routes/entries.py     (delete_entry host branch calls on_singer_removed when
                                       the removed entry was SINGING)
backend/tests/test_playback.py        (4 new moderation tests + the terminal-noop test)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/API_CONTRACT.md,
docs/RUNBOOK.md
```

## Implementation notes (M14)

- **Remove advances playback (E6):** `QueueService.remove` now returns
  `(entry, was_singing)`; when the removed entry was the current `SINGING`
  singer, the route calls `PlaybackService.on_singer_removed`, which promotes
  the new front to `NEXT` and begins the countdown transition (a host
  intervention skips the cooldown, D20). If nothing remains, playback returns
  to `IDLE`. On an ended session (cleanup) there is no playback to advance.
  Removing the `NEXT` entry mid-countdown self-heals: `advance` promotes
  whichever entry is now the front.
- **E21 no-op:** removing an already-terminal entry returns it unchanged
  (e.g. the participant cancelled it first → stays `CANCELLED`), and the
  `was_singing` flag is `False`, so no playback advance happens.
- **No frontend change needed:** the dashboard's Remove button drives the same
  DELETE endpoint; the realtime `QueueUpdated` snapshot then shows the new
  playback state (transition) and the player stops via the `nowSinging` ref.
- **No scope creep:** no notifications (M15), no round summaries (M16), no new
  dependencies, no schema change.

## Tests added (M14)

- `tests/test_playback.py` (4): remove current singer advances playback
  (COUNTDOWN + next NEXT); remove current singer when it's the only entry →
  IDLE; remove the NEXT entry mid-countdown self-heals (advance starts the new
  front); removing an already-terminal entry is a no-op (status preserved, E21).

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

**M15 — Next-singer notifications**: in-app "You're next!" notifications
(PRODUCT_SPEC §11) delivered over the realtime channel when an entry is promoted
to `NEXT` and again at countdown start. The M13 countdown already drives the
promotions, so this milestone surfaces them: a notification payload on the
`QueueUpdated`/singer events (or a dedicated event) that the participant queue
screen renders, plus the configurable timing from PRODUCT_SPEC §10.
