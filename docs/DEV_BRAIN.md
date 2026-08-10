# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M2 — Backend Skeleton + Database** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M3 — Host Authentication**.

## Verification results (M2 acceptance criteria, plan.md §M2)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Application starts | Verified — `uvicorn app.main:app` serves the API |
| PostgreSQL connects | Verified — readiness endpoint 200 against dockerized Postgres; 503 when stopped |
| Migrations run | Verified — `alembic upgrade head` applied `0001_initial` to real Postgres |
| Health endpoint works | Verified — `/`, `/health`, `/health/ready` all correct (see API_CONTRACT) |
| Automated test project runs | Verified — `uv run pytest`: 9 passed (SQLite, self-contained) |
| API request/response contracts use Pydantic models | Yes — `app/schemas/health.py` (ServiceInfo, ReadinessResponse, ComponentStatus) |
| Configuration uses Pydantic Settings | Yes — `app/core/config.py`, `KARAOKE_` prefix, cached singleton |
| Static type checking configured and passes | Verified — `uv run pyright`: 0 errors, 0 warnings |

Extra verification performed:

- `GET /health/ready` returned HTTP 503 `{"detail":"database unavailable"}` while
  Postgres was stopped (liveness endpoints unaffected).
- OpenAPI schema lists `['/', '/health', '/health/ready']`; structured JSON logs
  confirmed (uvicorn error/access lines emitted as single-line JSON).
- Frontend unaffected: `npm run typecheck`, `npm run lint`, `npm run build` clean.

## Files changed (M2)

```text
backend/app/main.py              (rewritten — app factory create_app)
backend/app/core/                (new — config.py, logging.py, database.py)
backend/app/models/              (new — base.py + __init__)
backend/app/schemas/             (new — health.py + __init__)
backend/app/api/                 (new — routes/health.py + __init__)
backend/app/domain/              (new — placeholder package)
backend/app/services/            (new — placeholder package)
backend/app/repositories/        (new — placeholder package)
backend/alembic/                 (new — async env.py, initial revision)
backend/alembic.ini              (new)
backend/.env.example             (new)
backend/tests/                   (conftest.py new; test_health.py updated;
                                  test_config.py, test_database.py new)
backend/pyproject.toml           (updated — deps, asyncio_mode)
backend/uv.lock                  (updated)
compose.yaml                     (new — dev PostgreSQL)
docs/DECISIONS.md                (updated — D21–D24)
docs/ARCHITECTURE.md             (updated — §3 implemented state, §7 phases)
docs/API_CONTRACT.md             (updated — §1 health incl. /health/ready)
docs/RUNBOOK.md                  (updated — DB setup, M2 checklist)
docs/PROJECT_BRAIN.md            (updated — milestones, commands, limitations)
docs/DEV_BRAIN.md                (updated, this file)
```

## Implementation notes (M2)

- **Layering:** api/core/models/schemas are live; domain/services/repositories are
  placeholder packages per the planned layout (ARCHITECTURE §3) and get real
  content from M4 onward. No unnecessary abstractions were added.
- **DB engine:** built once from settings (`app.core.database.build_engine`);
  SQLite URLs get a static pool so tests share one in-memory database. Engines
  connect lazily, so import never blocks on an unreachable database.
- **Readiness:** `/health/ready` probes with `SELECT 1` through the real
  `get_session` dependency and returns 503 on failure. Liveness (`/`, `/health`)
  stays database-independent.
- **Alembic:** async env reads the URL from `get_settings()` (not alembic.ini);
  `target_metadata = Base.metadata` for autogenerate. Initial revision is empty —
  no domain models exist yet.
- **Tests:** `tests/conftest.py` sets `KARAOKE_ENVIRONMENT=test` and
  `KARAOKE_DATABASE_URL=sqlite+aiosqlite://` before the app is imported, so the
  whole suite (incl. `/health/ready`) runs against SQLite without Docker. Env vars
  are hard-assigned (not `setdefault`) and config tests pin expected values
  explicitly, so a developer's local `backend/.env` (RUNBOOK setup step) cannot
  break the suite — verified both with and without `.env`.
- **Pyright note:** pydantic-settings' generated `_env_file`/`_secrets_dir`
  constructor params are unknown to pyright; tests construct `Settings()` directly
  (environment variables are pinned in conftest, so behavior is deterministic).

## Post-review fixes (M2)

Applied after the reviewer's `NEEDS_CHANGES` finding:

- `tests/conftest.py` — hard-assigned test env vars (was `setdefault`) so shell/.env
  leakage is impossible.
- `tests/test_config.py::test_settings_defaults` — pins expected default values via
  `monkeypatch.setenv` (env precedence beats dotenv); no longer breaks when a local
  `backend/.env` exists.
- `app/api/routes/health.py` — readiness now calls `check_database_connection`
  helper instead of duplicating the probe.
- `tests/test_database.py` — test renamed to assert the observable contract
  (single usable session); dropped a flawed `is_active` closed-state assertion
  (`is_active` is not a closed-state signal in SQLAlchemy).
- `app/schemas/health.py` — status fields tightened to `Literal["ok"]`.

## Tests added (M2)

- `tests/test_health.py` — `/`, `/health`, `/health/ready` (3 tests).
- `tests/test_config.py` — settings defaults, env override, env prefix (3 tests).
- `tests/test_database.py` — readiness probe, session query, DI yield/close (3 tests).
- **9 passed** total.

## Current blockers

- None.

## Unresolved technical questions

- None for M2. Tracked in `docs/DECISIONS.md` (Open questions): host auth mechanism
  (M3), YouTube metadata source (M6), realtime payload schemas (M10), Web Push (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.

## Next recommended task

**M3 — Host Authentication** — host registration/login with email/password,
password hashing, authentication tokens/cookies, logout, and protected host
endpoints (see `plan.md` §M3 and `docs/PRODUCT_SPEC.md` §2/§5.1).
