# RUNBOOK.md — Friday Karaoke local development

How to set up, run, and test the project locally.

---

## Prerequisites

- Python 3.12+ (project targets 3.12+; developed with 3.14)
- [uv](https://docs.astral.sh/uv/) (dependency management)
- Node.js 20+ and npm
- Docker with Docker Compose (provides the local PostgreSQL)
- PostgreSQL via Docker (from M2 onward; no longer needed as a host install)

## Repository layout

```text
backend/    FastAPI application (uv-managed Python project)
frontend/   React + TypeScript SPA (Vite)
compose.yaml  local development PostgreSQL service
docs/       project documentation (start with docs/PROJECT_BRAIN.md)
plan.md     milestone definitions and acceptance criteria
```

## Database (from M2)

```bash
# Start the local PostgreSQL (Postgres 17, credentials karaoke/karaoke, db karaoke)
docker compose up -d db
docker compose ps db          # wait for health "healthy"

# Apply migrations from the backend directory
cd backend
uv run alembic upgrade head
```

- The backend connects via `KARAOKE_DATABASE_URL` (default
  `postgresql+asyncpg://karaoke:karaoke@localhost:5432/karaoke`).
- Optional: copy `backend/.env.example` to `backend/.env` and adjust. All values
  have defaults in `app/core/config.py`.

## Backend

```bash
cd backend

# Install dependencies (creates/uses .venv)
uv sync

# Run the API (development, with auto-reload)
uv run uvicorn app.main:app --reload

# The API is served at http://localhost:8000
# Liveness:   curl http://localhost:8000/health
# Readiness:  curl http://localhost:8000/health/ready
# Identity:   curl http://localhost:8000/
```

### Backend tests

```bash
cd backend
uv run pytest
```

Tests are self-contained: they run against an in-memory SQLite database and do
not require Docker/PostgreSQL.

### Backend static type check

```bash
cd backend
uv run pyright
```

## Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server (default port 5173)
npm run dev

# Production build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Verification checklist (M4)

```bash
# From the repo root
docker compose up -d db

# Backend
cd backend && uv sync && uv run alembic upgrade head
uv run pytest && uv run pyright
uv run uvicorn app.main:app --reload

# Host auth smoke test (real PostgreSQL)
curl -X POST http://localhost:8000/api/v1/auth/host/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'   # 201
curl -X POST http://localhost:8000/api/v1/auth/host/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'
#   -> 200 {"token": "...", "token_type": "bearer", "host": {...}}
TOKEN=<token from the login response>
curl http://localhost:8000/api/v1/auth/host/me -H "Authorization: Bearer $TOKEN"  # 200
curl http://localhost:8000/api/v1/auth/host/me                                   # 401

# Session smoke test (real PostgreSQL)
curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
#   -> 201 {"id": "...", "name": "Friday Karaoke - 2026-08-11", "join_code": "K7X3QP",
#           "join_url": "http://localhost:5173/join/K7X3QP", "status": "CREATED", ...}
SESSION_ID=<id from the create response>
curl http://localhost:8000/api/v1/sessions/$SESSION_ID -H "Authorization: Bearer $TOKEN"        # 200
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/start -H "Authorization: Bearer $TOKEN"  # 200, status ACTIVE
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/start -H "Authorization: Bearer $TOKEN"  # 409 (already active)
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/end -H "Authorization: Bearer $TOKEN"    # 200, status ENDED
curl -X POST http://localhost:8000/api/v1/sessions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
#   -> 201; try GET with no token -> 401; with a second host's token -> 404

# Frontend (unchanged by M4)
cd ../frontend && npm install && npm run build && npm run typecheck
```

This satisfies the M4 acceptance criteria: a host creates a session
(`Friday Karaoke - <date>` default name) and receives a join code and join URL
(the QR flow itself is M5). Session state transitions are server-enforced
(start `CREATED -> ACTIVE`, end `-> ENDED`), cross-host access returns 404, and
invalid transitions return 409. Health + host auth from M2/M3 are unchanged.

## Branch / commit workflow

- Development happens on `dev`. Never commit directly to `master`.
- The `coder` agent implements milestones; `reviewer` reviews; `committer` stages
  and commits on `dev`.
- `master` only receives reviewed merges via the `/merge-to-master` command.
