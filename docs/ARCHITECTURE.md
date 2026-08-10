# ARCHITECTURE.md — Friday Karaoke

High-level design of the Friday Karaoke system. This is a living document and will
be refined as milestones are implemented. It describes both the current state and
the intended target state for v1.

---

## 1. System context

```text
                Internet / School WiFi
                         |
                         v
                Reverse Proxy (Caddy or Nginx)
                         |
            +------------+------------+
            |                         |
            v                         v
         Frontend                  Backend
       (React + TS SPA)          (FastAPI)
                                       |
                                       v
                                  PostgreSQL
```

- **Frontend** — React + TypeScript SPA built with Vite. Two main surfaces:
  participant flow (mobile-first) and host dashboard. Serves the QR join flow and
  the host playback UI. No authoritative state.
- **Backend** — FastAPI modular monolith. Owns all authoritative state:
  queue order, current singer, round state, playback state, permissions,
  participant identity, session state.
- **PostgreSQL** — durable persistence for the backend's authoritative state.
- **Realtime** — FastAPI WebSockets push meaningful domain events to connected
  clients. Delivery only; clients resync from the backend after reconnect.

## 2. Guiding principles

1. **Backend owns the truth.** The frontend never decides queue order, who is
   singing, round state, or playback state. It renders what the backend says.
2. **Host is the final authority.** Normal operation is automated, but the host can
   always skip, remove, edit, pause/resume, advance manually, and end the session.
3. **Host browser is the playback device.** The host dashboard embeds the YouTube
   player and is connected to the school's screen/speaker setup. Participant
   devices never play the song, avoiding cross-device sync problems.
4. **Realtime is a delivery mechanism.** WebSocket events are denormalized
   notifications. After a reconnect, the client must re-fetch authoritative state.
5. **Modular monolith first.** One deployable backend. No microservices, Kafka,
   RabbitMQ, Kubernetes, CQRS, or event sourcing unless a concrete later
   requirement demands them.

## 3. Backend structure (target)

Planned layout (implemented from M2 onward; M0 contains only a minimal app):

```text
backend/
    app/
        api/          # HTTP + WebSocket endpoints/routers
        core/         # config (Pydantic Settings), logging, security helpers
        domain/       # domain models, enums, business rules, state machines
        services/     # application use-cases / orchestration
        repositories/ # persistence access (SQLAlchemy)
        models/       # SQLAlchemy ORM models
        schemas/      # Pydantic API schemas
        main.py       # FastAPI app factory / entry point
    tests/            # pytest suite
    alembic/          # migrations
```

Rules:

- SQLAlchemy ORM models are separate from Pydantic schemas; explicit mappings.
- Pydantic v2 models at every API/application boundary.
- Pydantic Settings for configuration.
- Python `Enum` types for domain states.
- `UUID`, `datetime`, `timedelta` instead of strings for typed values.
- Explicit type hints everywhere; static type check (pyright/mypy) must pass.

## 4. Frontend structure (target)

```text
frontend/
    src/
        api/       # typed API client
        ws/        # typed WebSocket client
        features/
            join/       # QR join flow (nickname, song submission)
            queue/      # participant queue view
            host/       # host dashboard + playback
        app/       # routing, providers
        components/
        lib/       # shared utilities, PWA helpers
    public/        # manifest, icons, service worker
```

Frontend rules:

- Never store authoritative state; treat API responses as the source of truth.
- Reuse API types/schemas generated from backend Pydantic contracts where possible.
- Mobile-first participant UI; host dashboard designed for a projector/TV.
- Standard PWA (manifest + service worker) planned for M19.

## 5. Data flow (target state)

```text
Participant phone                   Host browser
     |                                   |
     | submit song URL                  | host action (skip/remove/...)
     v                                   v
Backend (validates URL, fetches metadata, appends queue entry)
     |
     | persists to PostgreSQL
     v
Backend publishes WebSocket events (QueueUpdated, SingerStarted, ...)
     |                                   |
     v                                   v
Participant phone updates            Host dashboard updates
```

Realtime is a notification channel. If it fails, participants can still reload and
get correct state from the API.

## 6. Playback architecture (target)

- Playback state machine lives in the backend (`IDLE -> PREPARING -> COUNTDOWN ->
  PLAYING -> COOLDOWN -> ...`), with explicit transitions.
- The host browser renders the YouTube embedded player and reports player events
  (started, ended, errors) back to the backend.
- Automatic advancement is the normal path and is fully configurable per session
  (e.g., post-song cooldown 10s, next-singer countdown 20s). The host can override
  at any time.
- Browser autoplay policies mean the host must interact with the page before audio
  playback; the UI must be designed around this.

## 7. Milestone phases (architecture growth)

- **M0** — repository + documentation (this milestone).
- **M2** — backend skeleton: FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic, Pydantic
  Settings, structured logging, health endpoint, project layers.
- **M3–M9** — vertical slice: auth, sessions, join flow, YouTube metadata, queue,
  participant UI, host dashboard.
- **M10–M16** — realtime + playback + rounds + notifications.
- **M17–M19** — security, testing, PWA/mobile UX.
- **M20–M22** — deployment, pilot, fixes.

## 8. Deployment (target)

- Docker Compose: frontend, backend, PostgreSQL.
- Reverse proxy terminates HTTPS (Caddy or Nginx).
- Environment variables/secrets for DB credentials, auth secrets, YouTube API
  credentials (if required), Web Push credentials, production URLs.
- Health checks, basic logging, restart policy, database backups.
- No Kubernetes unless a real operational requirement appears.
