# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M7 — Queue Management** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M8 — Participant Queue UI** (frontend).

## M7 scope (plan.md §M7)

- Authoritative queue engine: `QueueEntry` + `YouTubeVideo` (+ `Round`) tables.
- Submit a song (participant), public queue snapshot, cancel own WAITING entry
  (participant), remove any entry + edit a YouTube URL (host).
- Ordering by creation, not a mutable position field (B7/D8).
- Active-entry limit (B15/D17) and duplicate-song notice (B16/D15).

## Verification results (M7 acceptance criteria, plan.md §M7)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Multiple users can join and queue order remains deterministic | Verified — two participants submit sequentially and the snapshot returns them in submission order with positions 1 and 2 (`test_snapshot_returns_deterministic_order_and_positions`); ordering is `created_at` (microsecond Python default) + `id` tie-break (D36), caught a real SQLite second-precision bug during development. |

Extra verification performed:

- Submission guards: 401 without a token, 404 for a participant from another
  session, 409 for ended sessions, 422 for bad URLs, 404 for unavailable videos,
  409 at the active-entry limit (2 per participant per round, B15).
- Duplicate songs are allowed with an informational notice, never a block (B16);
  duplicate submissions share one `youtube_videos` row.
- Participant cancel (B3): own WAITING → 204/CANCELLED; others' entries, foreign
  sessions, and non-WAITING entries → 404/409.
- Host remove (B4): any entry → REMOVED; non-owner host → 404. Host edit (E7):
  position + participant preserved, invalid replacement keeps the old URL.
- `alembic check`: no drift; migration `0005_queue` upgrade → downgrade → upgrade
  verified on SQLite (round 1 is created by the service, not the migration).
- `uv run pytest`: 158 passed (27 new). `uv run pyright`: 0 errors, 0 warnings.
- Health, auth, sessions, join, preview endpoints unchanged and still green.

## Files changed (M7)

```text
backend/app/domain/queue_entry.py        (new — QueueEntryStatus enum)
backend/app/models/youtube_video.py      (new — YouTubeVideo metadata row)
backend/app/models/round.py              (new — Round, created with the session)
backend/app/models/queue_entry.py        (new — QueueEntry + relationships)
backend/app/models/__init__.py           (register new models)
backend/app/services/session.py          (create round 1 with the session)
backend/app/services/queue.py            (new — QueueService: submit/snapshot/cancel/remove/edit)
backend/app/schemas/queue.py             (new — submit/snapshot/entry schemas)
backend/app/api/routes/entries.py        (+ submit, snapshot, delete, edit endpoints)
backend/app/api/dependencies.py          (+ get_host_or_participant)
backend/app/main.py                      (include entry_router)
backend/alembic/versions/0005_queue.py   (new — youtube_videos, rounds, queue_entries)
backend/tests/test_queue.py              (new — 27 tests)
docs/API_CONTRACT.md                     (§5 songs/queue implemented)
docs/DECISIONS.md                        (D35 rounds at creation, D36 ordering, D37 shared video rows/dual-actor delete)
docs/ARCHITECTURE.md                     (§3 implementation status, §7 phases)
docs/PROJECT_BRAIN.md                    (milestones, limitations, decisions)
docs/DEV_BRAIN.md                        (updated, this file)
docs/RUNBOOK.md                          (M7 checklist + queue smoke test)
```

## Implementation notes (M7)

- **Rounds (D35):** `rounds` table with `(session_id, number)` unique; round 1 is
  created in the same transaction as the session. Queue entries, positions, and
  the active-entry limit are scoped to the session's latest round; M16 adds
  round N+1 without schema changes.
- **Ordering (D36):** `ORDER BY created_at, id`; `created_at` is assigned in
  Python (microsecond) because SQLite's `CURRENT_TIMESTAMP` is second-precision
  and scrambled same-second submissions (reproduced by a test before the fix).
- **Positions (D8):** computed from the ordered active queue when rendered;
  `position` in responses is derived (never stored).
- **YouTubeVideo (D37):** one immutable metadata row per unique video id,
  find-or-create with race handling (unique-index IntegrityError → re-select).
  Duplicate songs share the row; host edits point the entry at a new row.
- **Dual-actor DELETE (D37):** `get_host_or_participant` resolves the token as a
  participant (→ cancel) or host (→ remove); foreign entries/sessions → 404.
- **Active-entry limit (B15/D17):** 2 non-terminal entries (WAITING/NEXT/SINGING)
  per participant per round, counted server-side before insert.
- **Relationships:** `QueueEntry.participant/youtube_video/round` use
  `lazy="selectin"` (no N+1, no async lazy-load pitfalls). The host-edit path
  explicitly refreshes `youtube_video` after commit (the identity map otherwise
  serves the stale relationship).
- **FastAPI D30 rule respected:** new endpoints are `submit_song`,
  `queue_snapshot`, `delete_entry`, `edit_entry_video`; none collide with the
  `get_session`/`get_current_host`/`get_current_participant`/
  `get_host_or_participant` dependency names.

## Tests added (M7)

- `tests/test_queue.py` — 27 tests: submit (auth, WAITING entry shape, cross-
  session 404, ended 409, bad URL 422, unavailable 404, active-entry limit 409,
  duplicate notice, cancel-frees-a-slot), snapshot (public, deterministic order +
  positions, excludes processed, unknown 404), cancel (auth, own WAITING 204,
  others' 404, foreign session 404, non-WAITING 409, unknown 404), remove (host
  any entry, non-owner 404, unknown 404), edit (host-only auth, keeps position +
  participant, non-owner 404, invalid URL keeps old video), persistence (entries
  + shared video row).
- **158 passed** total (was 131 at M6).

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): realtime payload schemas
  (M10), Web Push (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.

## Next recommended task

**M8 — Participant Queue UI** (frontend): mobile-first queue screen using the
public snapshot endpoint from M7 — current singer, up next, queue with the
participant's position highlighted, submit song via preview + confirm, cancel
own WAITING entry, next-round prompt stub. First frontend milestone; see
`plan.md` §M8 and `docs/PRODUCT_SPEC.md` §6.5-6.6 / §7.1-7.3.
