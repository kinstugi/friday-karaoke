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

## Verification checklist (M6)

```bash
# From the repo root
docker compose up -d db

# Backend
cd backend && uv sync && uv run alembic upgrade head
uv run pytest && uv run pyright
uv run uvicorn app.main:app --reload

# Host auth + session + participant smoke test (real PostgreSQL)
curl -X POST http://localhost:8000/api/v1/auth/host/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'   # 201
curl -X POST http://localhost:8000/api/v1/auth/host/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'
TOKEN=<token from the login response>
curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
JOIN_CODE=<join_code from the create response>
SESSION_ID=<id from the create response>
curl -X POST http://localhost:8000/api/v1/join/$JOIN_CODE/participants \
  -H 'Content-Type: application/json' -d '{"nickname":"Emma"}'
PTOKEN=<participant token from the join response>

# Preview smoke test (needs KARAOKE_YOUTUBE_API_KEY in backend/.env)
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/entries/preview \
  -H "Authorization: Bearer $PTOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"youtube_url":"https://youtu.be/dQw4w9WgXcQ"}'
#   -> 200 {video_id, title, channel, duration_seconds, thumbnail_url, is_long, warning}
# Without a participant token: 401. Garbage URL: 422. Unavailable video: 404.

# Frontend (unchanged by M6)
cd ../frontend && npm install && npm run build && npm run typecheck
```

This satisfies the M6 acceptance criteria: a participant pastes a valid YouTube
URL and sees a preview (title/channel/duration/thumbnail) with a warning for
unusually long videos — never a rejection. URL format validation (E3),
unavailable-video handling (E4), participant token auth, session binding, and
the ended-session guard are all enforced server-side. Health, host auth,
sessions, and join endpoints from M2-M5 are unchanged.

## Branch / commit workflow

- Development happens on `dev`. Never commit directly to `master`.
- The `coder` agent implements milestones; `reviewer` reviews; `committer` stages
  and commits on `dev`.
- `master` only receives reviewed merges via the `/merge-to-master` command.
