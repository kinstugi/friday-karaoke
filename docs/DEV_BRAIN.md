# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M0 — Repository + Project Brain** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M1 — Product Specification + UX**.

## Verification results (M0 acceptance criteria)

| Acceptance criterion          | Result                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| Fresh clone can be opened     | Yes — docs + README + plan.md explain the project             |
| Documentation explains project| Yes — 7 docs under `docs/` (see below)                        |
| Backend starts                | Verified — `uvicorn app.main:app` serves `/` and `/health`    |
| Frontend starts               | Verified — `vite` dev server serves the app                  |
| No business functionality     | Yes — only a health endpoint and a placeholder screen         |

Checks run:

- `uv run pytest` — 2 passed.
- `uv run pyright` — 0 errors, 0 warnings.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.

## Files changed (M0)

```text
docs/PROJECT_BRAIN.md     (new)
docs/ARCHITECTURE.md      (new)
docs/DOMAIN_MODEL.md      (new)
docs/API_CONTRACT.md      (new)
docs/DECISIONS.md         (new)
docs/RUNBOOK.md           (new)
docs/DEV_BRAIN.md         (new, this file)
backend/                  (new — minimal FastAPI app + tests)
frontend/                 (new — Vite + React + TypeScript scaffold)
README.md                 (updated)
.gitignore                (verified/extended)
```

## Implementation notes (M0)

- Repository was already initialized with the agent workflow files (`AGENTS.md`,
  `opencode.json`, `.opencode/`); M0 adds the project structure on top.
- Backend is deliberately minimal: a FastAPI app with `/` and `/health` endpoints
  and a pytest suite. Database, config (Pydantic Settings), logging, and layering
  are M2 work and must NOT be built here.
- Frontend is the standard Vite + React + TypeScript scaffold with a placeholder
  screen. No app logic.
- Pydantic response models are used even for the health endpoint to establish the
  Pydantic-at-boundary convention from the start.
- Pyright is configured for static type checking and must pass.
- Python version: project targets 3.12+; the backend venv is pinned to 3.12 via
  `backend/.python-version` (system Python is newer — 3.14).

## Tests added (M0)

- `backend/tests/test_health.py` — verifies `/health` and `/` return 200 with the
  expected shape. **Passing (2 tests).**

## Current blockers

- None.

## Unresolved technical questions

- None for M0. Future questions are tracked in `docs/DECISIONS.md` (Open questions).
- Note: starlette emits a deprecation warning about `httpx` vs `httpx2` in
  `fastapi.testclient` (starlette 1.6). Non-blocking; revisit if it becomes an error.

## Next recommended task

**M1 — Product Specification + UX** — freeze the MVP behavior and edge cases
before implementing functionality (see `plan.md` §M1).
