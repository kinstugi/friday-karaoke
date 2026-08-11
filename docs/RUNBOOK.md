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

The Vite dev server proxies `/api` to `http://localhost:8000`, so run the backend
first (`uv run uvicorn app.main:app --reload` from `backend/`) and open
`http://localhost:5173/join/<join-code>`. The join code comes from creating a
session via the host API (see the verification checklist below).

## Verification checklist (M7)

```bash
# From the repo root
docker compose up -d db

# Backend
cd backend && uv sync && uv run alembic upgrade head
uv run pytest && uv run pyright
uv run uvicorn app.main:app --reload

# Setup: host -> session -> two participants (real PostgreSQL)
curl -X POST http://localhost:8000/api/v1/auth/host/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'   # 201
curl -X POST http://localhost:8000/api/v1/auth/host/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"host@school.edu","password":"correct-horse-battery"}'
TOKEN=<host token>
curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
SESSION_ID=<session id>
JOIN_CODE=<join code>
curl -X POST http://localhost:8000/api/v1/join/$JOIN_CODE/participants \
  -H 'Content-Type: application/json' -d '{"nickname":"Alice"}'
PTOKEN_A=<participant token>
curl -X POST http://localhost:8000/api/v1/join/$JOIN_CODE/participants \
  -H 'Content-Type: application/json' -d '{"nickname":"Bob"}'
PTOKEN_B=<participant token>

# Queue smoke test (needs KARAOKE_YOUTUBE_API_KEY in backend/.env)
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/entries \
  -H "Authorization: Bearer $PTOKEN_A" -H 'Content-Type: application/json' \
  -d '{"youtube_url":"https://youtu.be/dQw4w9WgXcQ"}'                    # 201, position 1
curl -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/entries \
  -H "Authorization: Bearer $PTOKEN_B" -H 'Content-Type: application/json' \
  -d '{"youtube_url":"https://youtu.be/9bZkp7q19f0"}'                    # 201, position 2
curl http://localhost:8000/api/v1/sessions/$SESSION_ID/entries           # public snapshot, positions 1..2
ENTRY_ID=<entry id from the snapshot>
curl -X DELETE http://localhost:8000/api/v1/entries/$ENTRY_ID \
  -H "Authorization: Bearer $PTOKEN_A"                                   # 204 (cancel own WAITING)
curl -X PATCH http://localhost:8000/api/v1/entries/$ENTRY_ID/video \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"youtube_url":"https://youtu.be/9bZkp7q19f0"}'                    # 200, position kept (host)
curl -X DELETE http://localhost:8000/api/v1/entries/$ENTRY_ID \
  -H "Authorization: Bearer $TOKEN"                                      # 204 (host remove)

# Frontend (M8: participant queue UI)
cd ../frontend && npm install && npm run build && npm run typecheck && npm run lint
# Manual: with the backend running, open http://localhost:5173/join/<join-code>
# on a phone-sized window -> join with a nickname -> add a song -> watch the queue.
```

This satisfies the M7 acceptance criteria: multiple participants submit and the
public snapshot returns the queue in deterministic submission order with
computed positions. The active-entry limit (2), duplicate-song notice, participant
cancel of own WAITING entries, and host remove/edit are enforced server-side.
The M8 participant screens (join/submit/queue) render exactly these backend
responses; the frontend never owns queue state. Health, host auth, sessions,
join, and preview endpoints from M2-M6 are unchanged.

## Branch / commit workflow

- Development happens on `dev`. Never commit directly to `master`.
- The `coder` agent implements milestones; `reviewer` reviews; `committer` stages
  and commits on `dev`.
- `master` only receives reviewed merges via the `/merge-to-master` command.
