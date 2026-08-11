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

## 3. Backend structure

Layout (implemented at M2: packages exist; `domain/` and `repositories/` were
placeholders; `services/` gained its first real use-case at M3 — host auth;
`domain/` gained its first real model at M4 — `SessionStatus`):

```text
backend/
    app/
        api/          # HTTP + WebSocket endpoints/routers (health M2, auth M3, sessions M4, join M5, entries M6)
        core/         # config (Pydantic Settings), structured logging, database, security
        domain/       # domain models, enums, business rules, state machines (SessionStatus M4)
        services/     # use-cases (host auth M3, sessions M4, join M5, youtube M6, queue M7)
        repositories/ # persistence access (SQLAlchemy) (deferred until shared)
        models/       # SQLAlchemy ORM models (Host, Session, Participant, YouTubeVideo, Round, QueueEntry)
        schemas/      # Pydantic API schemas (health M2; auth M3; sessions M4; join M5; youtube M6; queue M7)
        main.py       # FastAPI app factory / entry point
    tests/            # pytest suite (self-contained: in-memory SQLite)
    alembic/          # migrations (async env; 0001..0004)
    alembic.ini
```

Implementation status at M6:

- **Configuration:** Pydantic Settings (`app/core/config.py`), env prefix
  `KARAOKE_`, `.env` file support, cached singleton via `get_settings()`. Auth
  token lifetime via `KARAOKE_AUTH_TOKEN_TTL_DAYS` (default 30, M3). Public
  frontend base URL via `KARAOKE_PUBLIC_BASE_URL` (default `http://localhost:5173`,
  M4). YouTube Data API key via `KARAOKE_YOUTUBE_API_KEY` and long-video warning
  threshold via `KARAOKE_YOUTUBE_LONG_VIDEO_SECONDS` (default 600, M6).
- **Database:** async SQLAlchemy engine + session factory + `get_session`
  dependency (`app/core/database.py`); PostgreSQL via `asyncpg`, in-memory SQLite
  for tests. Models: `Host`, `HostAuthToken` (M3), `Session` (M4), `Participant`
  (M5), `YouTubeVideo`, `Round`, `QueueEntry` (M7, UUID PKs via
  `sqlalchemy.Uuid`, dialect-safe on both PostgreSQL and SQLite). Queue
  `created_at` uses a microsecond Python default so SQLite ordering is
  deterministic (D36).
- **Security:** bcrypt password hashing, opaque bearer token generation, SHA-256
  token digesting (`app/core/security.py`) — shared by host tokens (M3) and
  participant tokens (M5).
- **Domain:** `SessionStatus` enum + transition rules (`app/domain/session.py`,
  M4) mirroring the documented lifecycle
  `CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED`; `ENDED` is terminal
  and reachable from any other state.
- **Services:** `HostAuthService` (M3), `SessionService` (M4: create/get/start/
  end, unique join codes, creates round 1), `ParticipantService` (M5: public
  session lookup, participant registration, token lookup), `YouTubeService` (M6:
  Data API v3 metadata fetch, URL validation, duration parsing), `QueueService`
  (M7: submit with limit + duplicate notice, snapshots with computed positions,
  cancel/remove, host URL editing).
- **API:** health at root; host auth under `/api/v1/auth/host` (M3); sessions
  under `/api/v1/sessions` (create/get/**list (M9)**/start/end + SVG QR, M4/M5); public join
  under `/api/v1/join` (M5); song endpoints under `/api/v1/sessions/{id}/entries`
  (preview M6, submit + snapshot M7) and `/api/v1/entries` (cancel/remove, host
  edit, M7). `get_current_host`, `get_current_participant`, and
  `get_host_or_participant` dependencies enforce bearer tokens; ownership/session
  binding is enforced in services/endpoints (cross-owner → 404, D29). Business
  endpoints use the `/api/v1` base path (D26); health stays at the root.
- **Migrations:** Alembic async env wired to application settings; revisions
  `0001_initial` … `0005_queue`. `alembic check` reports no drift.

Rules:

- SQLAlchemy ORM models are separate from Pydantic schemas; explicit mappings.
- Pydantic v2 models at every API/application boundary.
- Pydantic Settings for configuration.
- Python `Enum` types for domain states.
- `UUID`, `datetime`, `timedelta` instead of strings for typed values.
- Explicit type hints everywhere; static type check (pyright/mypy) must pass.

## 4. Frontend structure

Implement at M9/M9.1 (design system via the `frontend-ui` skill; all screens
use token-driven styles from `src/index.css`); the host dashboard lands at M9:

```text
frontend/
    src/
        api/       # typed API client (client.ts, types.ts, session.ts, entries.ts, host.ts)
        ws/        # typed WebSocket client (M10)
        features/
            join/       # QR join flow (JoinScreen)
            submit/     # song submission (SubmitSongScreen)
            queue/      # participant queue view (QueueScreen)
            host/       # host dashboard (HostAuthScreen, HostHomeScreen, HostDashboardScreen)
        app/       # routing, providers
        components/
        lib/       # shared utilities (token/hostToken persistence, formatting, session labels)
    public/        # manifest, icons, service worker
```

Frontend rules (all in effect at M8/M9/M9.1):

- Never store authoritative state; treat API responses as the source of truth.
  The only client-side persistence is the participant identity (token/session)
  and the host identity (token/email) in localStorage (D38/D39/E8); queue state
  is never stored or merged client-side.
- The `frontend-ui` skill (`.opencode/skills/frontend-ui/SKILL.md`) is the
  frontend quality bar: design tokens (CSS variables in `src/index.css`), the
  two-surface layout rules (mobile-first participant vs projector/TV host),
  component patterns, and accessibility. The coder loads it for frontend work;
  the reviewer loads it for frontend reviews (M9.1).
- Reuse API types/schemas generated from backend Pydantic contracts where
  possible — `src/api/types.ts` mirrors the backend schemas by hand and the API
  client (`src/api/client.ts`) is a typed fetch wrapper.
- Mobile-first participant UI (large touch targets ≥ 44px); the host dashboard
  is designed for a projector/TV (large text, high contrast, minimal scrolling
  for current/next) (M9).
- Standard PWA (manifest + service worker) planned for M19.
- Realtime is a delivery mechanism only (D5); until the WebSocket channel lands
  in M10 the queue screen and host dashboard poll the authoritative snapshot
  every 5 s (D38).

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

- **M0** — repository + documentation (complete).
- **M2** — backend skeleton (complete): FastAPI app factory, async SQLAlchemy 2.x +
  asyncpg, PostgreSQL, Alembic, Pydantic Settings, structured JSON logging,
  readiness health endpoint, project layers.
- **M3** — host authentication (complete): email/password registration/login,
  bcrypt password hashing, opaque revocable bearer tokens (hashed at rest), logout,
  `/api/v1` base path confirmed, `Host` + `HostAuthToken` tables.
- **M4** — karaoke session creation (complete): host-owned sessions
  (create/get/start/end), `SessionStatus` domain state machine, unique join codes,
  derived join URLs, `Session` table.
- **M5** — public QR join flow (complete): public session lookup by join code,
  participant registration (nickname + opaque token), server-side SVG QR of the
  join URL, `Participant` table.
- **M6** — YouTube URL submission + metadata (complete): preview endpoint with
  URL validation, YouTube Data API v3 metadata fetch, configurable long-video
  warnings.
- **M7** — queue management (complete): authoritative queue engine
  (`QueueEntry`/`YouTubeVideo`/`Round` tables), submit + snapshot with computed
  positions, participant cancel, host remove/edit.
- **M8** — participant queue UI (complete, frontend): join/submit/queue screens,
  typed API client, localStorage identity, snapshot polling.
- **M9** — host dashboard (complete, frontend): host auth + home (session list,
  create) + dashboard (now/next cards, full queue, QR/join code, start/remove/
  edit/end actions; skip/finish/pause/resume rendered disabled until M11).
- **M9.1** — frontend UI polish (complete, frontend): `frontend-ui` skill
  (design system, two-surface rules, components, accessibility) + all screens
  refactored onto token-driven styles.
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
