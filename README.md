# Friday Karaoke

Private karaoke queue application for school Friday karaoke nights.

Hosts create a session, students scan a QR code, add songs via YouTube URLs, and
the queue runs with the host's browser as the playback device.

## Repository layout

```text
backend/    FastAPI backend (uv-managed Python project)
frontend/   React + TypeScript SPA (Vite)
docs/       project documentation
plan.md     milestone definitions and acceptance criteria
```

## Documentation

Start with `docs/PROJECT_BRAIN.md` — the authoritative project context for
developers and coding agents. Also see `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`,
`docs/API_CONTRACT.md`, `docs/DECISIONS.md`, and `docs/RUNBOOK.md`.

## Quick start

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000 (health: /health)
uv run pytest
uv run pyright
```

### Frontend

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173
npm run build
npm run typecheck
```

Full local development commands: `docs/RUNBOOK.md`.

## Status

Milestone 0 (repository + project brain) is complete. The backend and frontend
start; no business functionality exists yet. See `docs/DEV_BRAIN.md` for the
current milestone and next task.

## Branch workflow

Development happens on the `dev` branch. `master` only receives reviewed, merged
PRs (via the `/merge-to-master` command, which runs the `reviewer` agent first).
