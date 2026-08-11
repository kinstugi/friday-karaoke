# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M5 — Public QR Join Flow** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M6 — YouTube URL Submission + Metadata**.

## M5 scope (plan.md §M5)

- Public session lookup by join code (no auth).
- Participant registration by nickname (no account).
- Anonymous participant identity + secure opaque participant token.
- QR code generation/display (generation server-side; display is M9).

## Verification results (M5 acceptance criteria, plan.md §M5)

| Acceptance criterion | Result |
| -------------------- | ------ |
| A student scans the QR code and reaches the correct session | Verified end-to-end: the QR endpoint (`GET /api/v1/sessions/{id}/qr`) returns an SVG encoding the session's join URL (byte-verified against a re-rendered segno reference, `test_qr_returns_svg_for_owner`); scanning that URL leads to `GET /api/v1/join/{code}`, which returns the correct session snapshot, and `POST /api/v1/join/{code}/participants` registers the student by nickname (`test_lookup_returns_public_snapshot`, `test_register_returns_token_session_and_participant`). |

Extra verification performed:

- Join lookup is public (200 without any token) and case-insensitive
  (`test_lookup_requires_no_authentication`, `test_lookup_is_case_insensitive`).
- Nickname rules B14/D16: trimmed, 1-20 chars, case-insensitive uniqueness per
  session; duplicates → 409, blank/overlong → 422, display case preserved,
  normalized copy stored (`test_register_*`).
- Ended sessions: lookup still returns the snapshot (status ENDED) so the UI can
  show "this karaoke night has ended"; registration is rejected with 409
  (`test_lookup_ended_session_still_returns_snapshot`,
  `test_register_ended_session_conflicts`).
- Token hygiene: participant token is opaque, stored only as SHA-256 digest
  (`test_register_token_is_stored_hashed`).
- `alembic check`: no drift; migration `0004_participants` upgrade →
  downgrade → upgrade verified on SQLite.
- `uv run pytest`: 85 passed (21 new: 17 join + 4 QR). `uv run pyright`:
  0 errors, 0 warnings.
- Health, host auth, and session endpoints unchanged and still green.

## Files changed (M5)

```text
backend/pyproject.toml                (deps: segno for QR generation)
backend/uv.lock                       (updated)
backend/app/models/participant.py     (new — Participant ORM model)
backend/app/models/__init__.py        (+ Participant)
backend/app/schemas/participant.py    (new — join/participant schemas)
backend/app/services/participant.py   (new — ParticipantService: lookup + register)
backend/app/api/routes/join.py        (new — /api/v1/join router)
backend/app/api/routes/sessions.py    (+ GET /{id}/qr SVG QR endpoint)
backend/app/main.py                   (include join router)
backend/alembic/versions/0004_participants.py (new — participants table)
backend/tests/test_join.py            (new — 17 join-flow tests)
backend/tests/test_sessions.py        (+ 4 QR tests)
docs/API_CONTRACT.md                  (§3 QR endpoint; §4 public join implemented)
docs/DECISIONS.md                     (D31 participant identity, D32 server-side QR)
docs/ARCHITECTURE.md                  (§3 implementation status, §7 phases)
docs/PROJECT_BRAIN.md                 (milestones, limitations, decisions)
docs/DEV_BRAIN.md                     (updated, this file)
docs/RUNBOOK.md                       (M5 checklist + join smoke test)
```

## Implementation notes (M5)

- **Public by design:** the join endpoints carry no auth dependency. Anyone with
  the join code can look up a session and register (B2/D6); the QR encodes the
  public join URL so this surface is intentional.
- **Participant identity (D31):** `participants` stores `nickname` (display case
  preserved) + `nickname_lower` (lowercased) with a `(session_id,
  nickname_lower)` unique constraint for portable case-insensitive uniqueness.
  The opaque token reuses the M3 helpers (`generate_auth_token` /
  `hash_auth_token` from `app.core.security`) and is stored as a SHA-256 digest.
- **Nickname validation:** Pydantic enforces 1-20 on raw input; the service then
  trims and re-checks (blank-after-trim → 422). Duplicate (case-insensitive,
  including a lost unique-constraint race) → 409.
- **Ended sessions (E18):** `GET /join/{code}` returns the snapshot with
  `status: ENDED` (the join screen renders the "ended" message); registration
  raises `SessionEndedError` → 409.
- **QR (D32):** `GET /api/v1/sessions/{id}/qr` (owning host only) renders the
  join URL as an SVG via `segno` (`error="m"`, `scale=4`), deterministic output.
  Display on the projector is the host dashboard's job (M9).
- **Join code lookup:** normalized with `.strip().upper()` — D27 codes are
  uppercase from an unambiguous alphabet, so typed lowercase still works.
- **Repositories:** still a placeholder; services use the database session
  directly (consistent with M3/M4).
- **FastAPI D30 rule respected:** new endpoints are named `lookup_session`,
  `register_participant`, `session_qr` — none collide with the `get_session` /
  `get_current_host` dependency names.

## Tests added (M5)

- `tests/test_join.py` — 17 tests: public lookup (no auth, snapshot shape,
  unknown code 404, case-insensitive, ended session still returned), registration
  (no auth, token+session+participant shape, unknown code 404, ended 409, blank
  nickname 422, overlong nickname 422, case-insensitive duplicate 409, same
  nickname in different sessions OK, trim), persistence/hygiene (row persisted
  with normalized nickname, token stored hashed, participant belongs to session).
- `tests/test_sessions.py` — 4 QR tests: auth required (401), SVG matches a
  re-rendered segno reference of the join URL, another host 404, unknown session
  404.
- **85 passed** total (was 64 at M4).

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

**M6 — YouTube URL Submission + Metadata** — public preview endpoint that
validates a YouTube URL (watch + youtu.be), extracts the video ID, and returns
metadata (title, channel, duration, thumbnail) with a warning for unusually long
videos (never auto-reject). The participant token from M5 authorizes it. See
`plan.md` §M6 and `docs/PRODUCT_SPEC.md` §6.3-6.4 / §8 E3-E4.
