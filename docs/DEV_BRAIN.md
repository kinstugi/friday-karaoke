# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M3 — Host Authentication** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M4 — Karaoke Session Creation**.

## M3 scope (plan.md §M3)

- Host registration/login with email/password.
- Password hashing (bcrypt).
- Authentication tokens (opaque bearer tokens, revocable).
- Authorization (host-only endpoints via `get_current_host`).
- Logout (revokes the token).
- Protected host endpoints (`GET /api/v1/auth/host/me`; the session endpoints
  themselves land in M4 and reuse `get_current_host`).

## Verification results (M3 acceptance criteria, plan.md §M3)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Anonymous users cannot create sessions | Session creation is M4; the auth infrastructure is verified by `GET /api/v1/auth/host/me` returning 401 without/with an invalid token. M4 session endpoints reuse `get_current_host`. |
| Authenticated host can access host endpoints | Verified — `GET /me` returns 200 with the host profile using a login token (SQLite tests + real PostgreSQL smoke test). |
| Another host cannot modify someone else's session | Sessions land in M4, but the foundation is verified: each token resolves to exactly the host it was issued to (`test_me_returns_own_host_not_another`). M4 ownership checks build on this. |

Extra verification performed:

- Full curl smoke test against real PostgreSQL (uvicorn): register 201 (email
  normalized lowercase), duplicate register 409, case-insensitive login 200 with
  token, `/me` 200 with valid token and 401 with garbage token, anonymous 401,
  logout 204, `/me` 401 after logout.
- `alembic check` reports "No new upgrade operations detected" — the migration
  exactly matches the ORM models.
- Migration `0002_host_auth` verified on SQLite (upgrade → downgrade → upgrade) and
  real PostgreSQL (native `uuid`, `timestamptz`, unique indexes, FK `ON DELETE
  CASCADE`).
- `/`, `/health`, `/health/ready` unchanged and still 200 against Postgres;
  structured JSON logging confirmed on `uv run uvicorn`.
- `uv run pytest`: 35 passed. `uv run pyright`: 0 errors, 0 warnings.
- Frontend untouched (M3 is backend-only).

## Files changed (M3)

```text
backend/pyproject.toml                (deps: bcrypt, email-validator)
backend/uv.lock                       (updated)
backend/app/core/config.py            (+ auth_token_ttl_days)
backend/app/core/security.py          (new — bcrypt hash/verify, token gen/hash)
backend/app/models/host.py            (new — Host)
backend/app/models/host_auth_token.py (new — HostAuthToken)
backend/app/models/__init__.py        (register new models)
backend/app/schemas/auth.py           (new — register/login/host/auth responses)
backend/app/services/host_auth.py     (new — HostAuthService)
backend/app/api/dependencies.py       (new — bearer_scheme, get_current_host)
backend/app/api/routes/auth.py        (new — /api/v1/auth/host router)
backend/app/main.py                   (include auth router)
backend/alembic/versions/0002_host_auth.py (new — hosts + host_auth_tokens)
backend/tests/conftest.py             (+ autouse schema create/drop fixture)
backend/tests/test_auth.py            (new — 19 endpoint/service tests)
backend/tests/test_security.py        (new — 7 unit tests)
backend/tests/test_config.py          (pin KARAOKE_AUTH_TOKEN_TTL_DAYS default)
backend/.env.example                  (+ KARAOKE_AUTH_TOKEN_TTL_DAYS)
docs/API_CONTRACT.md                  (§2 host auth implemented, base path confirmed)
docs/DECISIONS.md                     (D25 opaque tokens, D26 base path; open Q resolved)
docs/ARCHITECTURE.md                  (§3 implementation status, §7 phases)
docs/PROJECT_BRAIN.md                 (milestones, limitations, decisions)
docs/DEV_BRAIN.md                     (updated, this file)
```

## Implementation notes (M3)

- **Auth mechanism (D25):** opaque bearer tokens issued at login, stored only as a
  SHA-256 digest (`host_auth_tokens.token_hash`). Logout deletes the row. Tokens
  expire after `KARAOKE_AUTH_TOKEN_TTL_DAYS` (default 30). No JWT, no cookies.
- **Passwords:** bcrypt via the `bcrypt` library directly (no passlib). API schemas
  cap password length at 72 characters (bcrypt's byte limit) and require ≥ 8.
- **Emails:** `EmailStr` (email-validator) + lowercase normalization in the
  service; the `unique` constraint on the (lowercased) email gives case-insensitive
  uniqueness on both SQLite and PostgreSQL.
- **Layering:** `services/` gained its first real use-case (`HostAuthService`).
  `repositories/` is still a placeholder — the service talks to the session
  directly; a repository layer will be introduced at M4+ when persistence logic is
  actually shared. `domain/` remains a placeholder (no domain enums needed for M3).
- **UUIDs:** `sqlalchemy.Uuid` for all PK/FK columns — native `uuid` on PostgreSQL,
  `CHAR(32)` on SQLite (dialect-safe per D22).
- **Timezone safety:** token expiry is checked in Python (`_is_expired`) rather than
  in SQL, because SQLite returns naive datetimes and PostgreSQL returns aware ones;
  the helper normalizes the comparison.
- **Expired-token handling:** expired tokens are treated as unknown (401
  "invalid or expired token"); they are not auto-deleted (cleanup can come with M17).
- **Logout is idempotent:** revoking an already-revoked/unknown token returns 204.
- **Tests:** `conftest.py` gained an autouse fixture that drops/creates all tables
  before every test (the test engine uses one in-memory SQLite DB via a static
  pool, so per-test DDL gives isolation). `Host`/`HostAuthToken` registered in
  `app/models/__init__.py` for both Alembic autogenerate and the test fixture.

## Tests added (M3)

- `tests/test_security.py` — bcrypt hashing/verification (incl. malformed hash),
  token generation uniqueness/opacity, deterministic SHA-256 digesting (7 tests).
- `tests/test_auth.py` — registration (create, lowercase normalization, duplicate
  conflict, invalid email, short/overlong password), login (token+bearer, case
  insensitivity, wrong password, unknown email), protected `/me` (401 anonymous,
  401 invalid token, returns own host, distinct hosts per token), logout (revokes,
  requires auth), at-rest hygiene (bcrypt hash stored, token stored hashed not
  plaintext), expired token rejected (19 tests).
- **35 passed** total (was 9 at M2).

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): YouTube metadata source (M6),
  realtime payload schemas (M10), Web Push (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.

## Next recommended task

**M4 — Karaoke Session Creation** — host-owned sessions with join codes; the
`get_current_host` dependency from M3 is the authorization seam. See `plan.md`
§M4 (session fields/statuses, create/get/start/end, unique join code, join URL)
and `docs/PRODUCT_SPEC.md` §3/§5.
