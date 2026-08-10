# backend

FastAPI backend for the Friday Karaoke application.

See the repository root `README.md` and `docs/RUNBOOK.md` for setup and commands.

## Local development

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Health check: `curl http://localhost:8000/health`

## Tests and type checks

```bash
uv run pytest
uv run pyright
```
