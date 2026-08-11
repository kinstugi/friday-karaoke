# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M4 — Karaoke Session Creation** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M5 — Public QR Join Flow**.

## M4 scope (plan.md §M4)

- Host creates a karaoke session (`Friday Karaoke - <date>` default name).
- Session fields: `id`, `hostId`, `name`, `joinCode`, `status`, `createdAt`,
  `startedAt`, `endedAt`.
- `SessionStatus` enum: CREATED / ACTIVE / PAUSED / ROUND_COMPLETE / ENDED.
- Create / get / start / end session APIs (host-owned, `get_current_host`).
- Unique join-code generation; join URL derived from `KARAOKE_PUBLIC_BASE_URL`.

## Verification results (M4 acceptance criteria, plan.md §M4)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Host can create "Friday Karaoke - 2026-08-14" | Verified — `POST /api/v1/sessions` with no name returns `Friday Karaoke - <server local date>`; custom names are trimmed and used (`test_create_session_defaults_name`, `test_create_session_uses_custom_name`). |
| Host receives a join URL/code | Verified — response includes a 6-char unambiguous `join_code` (unique across sessions) and `join_url = {KARAOKE_PUBLIC_BASE_URL}/join/{join_code}` (`test_join_codes_are_unique`, `test_join_url_is_derived_from_base_url`). |

Extra verification performed:

- Full state machine: start `CREATED -> ACTIVE` stamps `started_at`; double start →
  409; start after end → 409; end from any non-terminal state stamps `ended_at`;
  double end → 409 (`app/domain/session.py` + endpoint tests).
- Ownership: a second host gets `404 session not found` for the first host's
  session on get/start/end (no existence leak, D29).
- `alembic check` reports "No new upgrade operations detected" — migration
  `0003_sessions` exactly matches the ORM models; upgrade → downgrade → upgrade
  verified on SQLite.
- `uv run pytest`: 64 passed (29 new session/state-machine tests). `uv run
  pyright`: 0 errors, 0 warnings.
- Health + host-auth endpoints unchanged and still green.

## Files changed (M4)

```text
backend/app/domain/session.py              (new — SessionStatus enum + transitions)
backend/app/models/session.py              (new — Session ORM model)
backend/app/models/__init__.py             (+ Session)
backend/app/schemas/session.py             (new — SessionCreateRequest, SessionResponse)
backend/app/services/session.py            (new — SessionService: create/get/start/end, join code)
backend/app/api/routes/sessions.py         (new — /api/v1/sessions router)
backend/app/main.py                        (include sessions router)
backend/alembic/versions/0003_sessions.py  (new — sessions table)
backend/app/core/config.py                 (+ public_base_url)
backend/.env.example                       (+ KARAOKE_PUBLIC_BASE_URL)
backend/tests/test_sessions.py             (new — 29 tests: 24 endpoint + 5 unit)
backend/tests/test_config.py               (pin KARAOKE_PUBLIC_BASE_URL default)
docs/API_CONTRACT.md                       (§3 sessions implemented)
docs/DECISIONS.md                          (D27 join code, D28 join URL, D29 ownership, D30 FastAPI bug)
docs/ARCHITECTURE.md                       (§3 implementation status, §7 phases)
docs/PROJECT_BRAIN.md                      (milestones, limitations, decisions)
docs/DEV_BRAIN.md                          (updated, this file)
docs/RUNBOOK.md                            (M4 checklist + session smoke test)
```

## Implementation notes (M4)

- **Domain state machine first:** `app/domain/session.py` defines `SessionStatus`
  (all five documented states) and `can_transition_to` mirroring PRODUCT_SPEC §3.
  The service applies these rules before mutating; the API maps violations to 409.
  The `domain/` package placeholder is now real for sessions.
- **Join codes (D27):** 6 uppercase chars from an unambiguous alphabet
  (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no 0/O/1/I), unique index on
  `sessions.join_code`, pre-checked at generation with a bounded retry (10).
- **Join URL (D28):** derived, never stored — `{KARAOKE_PUBLIC_BASE_URL}/join/{code}`.
  New setting `KARAOKE_PUBLIC_BASE_URL` (default `http://localhost:5173`).
- **Ownership (D29):** every session query filters by `host_id`; unknown *or*
  foreign sessions raise `SessionNotFoundError` → 404. Started/ended timestamps are
  UTC-aware (`datetime.now(timezone.utc)`); `created_at` uses `server_default
  func.now()` like the M3 models.
- **Status column:** non-native `sa.Enum(SessionStatus, native_enum=False)` →
  VARCHAR(32) with a server default `'CREATED'`, keeping the schema portable
  across SQLite tests and PostgreSQL (D22).
- **Repositories:** still a placeholder. The service talks to the database session
  directly, consistent with M3's `HostAuthService`; a repository layer is deferred
  until persistence is shared between services.
- **FastAPI 0.141.1 bug (D30):** the GET endpoint was initially named
  `get_session`, which collides with the `get_session` dependency by `__name__`.
  On literal-suffix routes (`POST /{id}/start`, `/end`) FastAPI then invoked the
  *endpoint* instead of the dependency and injected a constructed response model
  (500). Root-caused with a minimal repro; fixed by naming the endpoint
  `session_detail`. Rule going forward: **endpoint functions must never share a
  `__name__` with a dependency function.**

## Tests added (M4)

- `tests/test_sessions.py` — 29 tests: session create (auth required, default
  name, custom name, overlong name 422, owner persisted, unique join codes, join
  URL derivation), get (auth, owned, another host 404, missing 404, bad UUID 422),
  start (auth, CREATED→ACTIVE + `started_at`, another host 404, double start 409,
  start-after-end 409), end (auth, active→ENDED + `ended_at`, created→ENDED,
  another host 404, double end 409), plus 5 `SessionStatus` state-machine unit
  tests (`test_created_can_start_and_end`, `test_created_cannot_skip_to_paused_or_round_complete`,
  `test_ended_is_terminal`, `test_end_allowed_from_every_non_terminal_state`,
  `test_start_only_allowed_from_created_and_active_neighbors`).
- **64 passed** total (was 35 at M3).

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): YouTube metadata source (M6),
  realtime payload schemas (M10), Web Push (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.

## Next recommended task

**M5 — Public QR Join Flow** — public session lookup by join code
(`GET /join/{joinCode}`), participant registration with nickname + opaque
participant token, and QR generation/display. The join URL built in M4
(`{public_base_url}/join/{code}`) is the exact surface M5 implements. See
`plan.md` §M5 and `docs/PRODUCT_SPEC.md` §5.2/§6.
