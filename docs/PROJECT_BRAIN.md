# PROJECT_BRAIN.md — Friday Karaoke

This is the authoritative, persistent project context for every coding agent.
**Read this file before modifying the project.**

Related files:

- `plan.md` — full milestone definitions and acceptance criteria
- `docs/PRODUCT_SPEC.md` — frozen MVP behavioral contract (flows, edge cases, rules)
- `docs/ARCHITECTURE.md` — system design
- `docs/DOMAIN_MODEL.md` — entities, states, relationships
- `docs/API_CONTRACT.md` — planned API surface
- `docs/DECISIONS.md` — architectural decisions (and why)
- `docs/DEV_BRAIN.md` — active development context (current task)
- `docs/RUNBOOK.md` — local development commands

---

## 1. Product purpose

A private karaoke queue application for our school's Friday karaoke nights.
It removes the repetitive work currently done by the host:

1. Host creates a karaoke session.
2. Application generates a QR code.
3. Students scan the QR code.
4. Students enter a nickname and paste the YouTube URL of the song they want.
5. The application fetches/displays the video metadata and puts the entry in the queue.
6. Everyone can see the current queue and their position.
7. The host has final control over the queue and playback.
8. The host's browser is the playback device (connected to the school's screen/speakers).
9. Songs transition automatically, with configurable preparation/cooldown time.
10. The next singer is notified.
11. When a round ends, participants are asked whether they want to join the next round.
    Default: YES if they do nothing.

The application is intended for **real use at school**, not just a portfolio demo.

## 2. Target users

- **Host** — the person who runs the Friday karaoke night (teacher/student organizer).
  Has an account, creates/manages sessions, has final authority over the queue and playback.
- **Participants** — students who attend. **No account required.** They scan the QR code,
  enter a nickname, and submit YouTube URLs. They can watch the queue and their position.

## 3. Core user journeys

Detailed flows, screens, edge cases, and normative behavioral rules are frozen in
**`docs/PRODUCT_SPEC.md`** (M1). The short versions:

### Host

```text
Login
  -> Create session
  -> Display QR
  -> Monitor queue
  -> Start / skip / edit / remove
  -> Automatic playback (host browser is the playback device)
  -> Finish round
  -> Start next round
  -> End session
```

### Participant

```text
Scan QR
  -> Enter nickname
  -> Paste YouTube URL
  -> Review song metadata
  -> Join queue
  -> Monitor position
  -> Receive "you're next"
  -> Perform
  -> Participate in next round (default YES)
```

## 4. Current architecture (summary)

- One **modular monolith** backend (FastAPI + PostgreSQL). No microservices.
- Backend/database is the **single source of truth** for queue order, current singer,
  round state, playback state, permissions, participant identity, and session state.
- Frontend is a React + TypeScript SPA (Vite). It never owns authoritative state.
- Realtime delivery via **FastAPI WebSockets** (planned M10). WebSockets are a delivery
  mechanism, **not** the source of truth; clients resync from the backend after reconnect.
- The **host's browser is the playback device** (YouTube embedded player).
  Participants' phones never play the song.

See `docs/ARCHITECTURE.md` for details.

## 5. Technology stack

| Concern          | Choice                          |
| ---------------- | ------------------------------- |
| Backend          | Python 3.12+ / FastAPI          |
| Database         | PostgreSQL                      |
| ORM              | SQLAlchemy 2.x                  |
| Migrations       | Alembic                         |
| Realtime         | FastAPI WebSockets              |
| Frontend         | React + TypeScript              |
| Build tooling    | Vite                            |
| PWA              | web manifest + service worker   |
| Containers       | Docker / Docker Compose         |
| Reverse proxy    | Caddy or Nginx                  |
| Notifications    | Web Push                        |
| Testing          | pytest + integration tests      |
| Dependency mgmt  | uv (preferred)                  |
| Validation       | Pydantic v2                      |
| Settings         | Pydantic Settings               |
| ASGI server      | Uvicorn                          |
| Static types     | Pyright or mypy                  |

## 6. Domain concepts

See `docs/DOMAIN_MODEL.md` for full detail. High-level:

- **Host** — account holder with authority over sessions.
- **Session** — one karaoke night. Contains multiple rounds. Has a join code / QR link.
- **Participant** — session-scoped identity (nickname). No account. Created by joining.
- **Round** — one pass through the queue within a session.
- **QueueEntry** — a participant's song in a round, with status and a *computed*
  position (derived from authoritative order, never stored as a mutable field).
- **YouTubeVideo** — metadata snapshot (video ID, URL, title, channel, duration, thumbnail).

```text
Host
 |
 +---- Session
          |
          +---- Participant
          |
          +---- Round
                  |
                  +---- QueueEntry
                          |
                          +---- YouTubeVideo
```

## 7. Important business rules

The normative, implementer-facing rules are in `docs/PRODUCT_SPEC.md` §9
(rules B1–B18). The high-level rules below remain the canonical summary:

1. Only authenticated hosts can create/manage sessions.
2. Anyone with the session QR/link can join. Participants need no account.
3. Participants can cancel their own waiting entries; they cannot modify others'.
4. Host has final authority over the queue (remove any entry, edit YouTube URLs, skip,
   pause/resume, advance manually, end the session).
5. Invalid YouTube URLs cannot be queued. Long videos produce a **warning**, not a rejection.
6. Queue order is determined by authoritative backend state (creation order), not a
   mutable position field.
7. Host playback is authoritative for actual song playback.
8. Automatic advancement can always be overridden by the host.
9. A session contains multiple rounds (do not create a new session per round).
10. At round completion, participants are asked whether they want the next round.
    Default answer is YES; an explicit NO excludes them from the next round.
11. Realtime events are not authoritative state. Reconnecting clients must resync.
12. Host actions must be authorized server-side.
13. The application must remain usable if realtime connections temporarily fail.

Additional M1 decisions (duplicate songs allowed, nickname rules, active-entry
limit, sessions not tied to a browser) are in `docs/PRODUCT_SPEC.md` §8–§9 and
`docs/DECISIONS.md` D15–D20.

## 8. Current milestone

**M7 — Queue Management** (next). M6 is complete; see `docs/DEV_BRAIN.md` for
live status.

## 9. Completed milestones

- **M6 — YouTube URL Submission + Metadata** (complete): `POST
  /api/v1/sessions/{id}/entries/preview` (participant token) validates YouTube
  URLs (watch/youtu.be/embed/shorts), extracts the video ID, fetches metadata
  (title/channel/duration/thumbnail) from the YouTube Data API v3 (D33,
  `KARAOKE_YOUTUBE_API_KEY`), and returns a stateless preview with a
  configurable long-video warning that never rejects (D34, B6). New
  `get_current_participant` dependency; metadata decisions D33–D34 recorded in
  `docs/DECISIONS.md`.
- **M5 — Public QR Join Flow** (complete): public session lookup by join code
  (`GET /api/v1/join/{code}`, case-insensitive) and participant registration
  (`POST /api/v1/join/{code}/participants`) — no account, nickname rules
  B14/D16 (trimmed, 1-20 chars, case-insensitive uniqueness per session), opaque
  participant tokens stored as SHA-256 digests (D31), ended-session guard, and a
  server-side SVG QR endpoint `GET /api/v1/sessions/{id}/qr` encoding the join
  URL (D32). `Participant` table (migration `0004_participants`); `segno` added
  for QR generation. Decisions D31–D32 in `docs/DECISIONS.md`.
- **M4 — Karaoke Session Creation** (complete): host-owned sessions with
  create/get/start/end under `/api/v1/sessions` (auth via `get_current_host`,
  cross-host access → 404), the `SessionStatus` domain state machine
  (`CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED`), 6-char
  unambiguous unique join codes (D27), derived join URLs from
  `KARAOKE_PUBLIC_BASE_URL` (D28), ownership + strict-transition semantics (D29),
  `Session` table (migration `0003_sessions`), and a documented FastAPI 0.141.1
  dependency-name collision workaround (D30 — never name an endpoint like a
  dependency). Sessions decisions D27–D30 recorded in `docs/DECISIONS.md`.
- **M3 — Host Authentication** (complete): host registration/login with
  email/password, bcrypt password hashing, opaque revocable bearer tokens (only a
  SHA-256 digest stored), logout, the `get_current_host` dependency protecting host
  endpoints, `GET /api/v1/auth/host/me`, `Host` + `HostAuthToken` tables (migration
  `0002_host_auth`), and confirmation of the `/api/v1` API base path (D26). Auth
  decisions D25–D26 recorded in `docs/DECISIONS.md`.
- **M2 — Backend Skeleton + Database** (complete): FastAPI app factory, async
  SQLAlchemy 2.x + asyncpg, PostgreSQL via Docker Compose (`compose.yaml`), Alembic
  migrations (async env, initial revision), Pydantic Settings (`KARAOKE_` prefix),
  structured JSON logging, project layers (api/core/models/schemas + empty
  domain/services/repositories), and health endpoints (`/`, `/health`,
  `/health/ready` with a database probe). Tests run self-contained on SQLite;
  verified against real PostgreSQL locally.
- **M1 — Product Specification + UX** (complete): MVP behavior frozen in
  `docs/PRODUCT_SPEC.md` — roles and authority matrix, session/round lifecycles,
  detailed host and participant flows, screen inventory, 24 edge cases (E1–E24),
  and normative behavioral rules B1–B18. Behavioral decisions D14–D20 recorded in
  `docs/DECISIONS.md`.
- **M0 — Repository + Project Brain** (complete): repository layout, backend
  (FastAPI + health check), frontend (Vite + React + TS scaffold), and the full
  documentation set under `docs/`. Backend and frontend both start; no business
  functionality exists yet.

## 10. Known limitations

- No queue yet (queue entries + persistence land in M7); the M6 preview is
  stateless.
- Only the `Host`, `HostAuthToken`, `Session`, and `Participant` domain tables
  exist (migration `0004`). PAUSED and ROUND_COMPLETE session states are defined
  but not reachable yet (M14/M16).
- Song previews require `KARAOKE_YOUTUBE_API_KEY` (YouTube Data API v3, D33);
  without it the preview endpoint returns 503. Tests mock the HTTP call.
- Participant tokens are issued at join but only authorize participant
  endpoints from M6 (preview) / M7 (queue).
- Host bearer tokens are long-lived (30 days) unless logged out; fine for the
  pilot, token rotation/refresh is not in scope for v1.
- Browser autoplay policies will require host interaction before audio playback
  (to be designed for in M12/M13).
- The automated test suite uses in-memory SQLite; Postgres-specific SQL should be
  avoided in domain code or handled dialect-aware (see DECISIONS D22). UUID columns
  use the generic `sqlalchemy.Uuid` type, which is dialect-safe.
- FastAPI 0.141.1 has an unresolved dependency-name collision bug (D30): an
  endpoint function sharing a `__name__` with a dependency breaks literal-suffix
  routes. Workaround (naming convention) is in effect; watch for an upstream fix.

## 11. Important decisions

See `docs/DECISIONS.md` for the full, maintained list. Highlights:

- Modular monolith; no microservices/Kafka/Kubernetes unless a concrete requirement appears.
- Backend is the single source of truth; frontend never owns state.
- Host browser is the playback device.
- WebSockets deliver events but never replace authoritative state.
- Participants are session-scoped identities, not accounts.
- Do not over-validate YouTube content (validate format, warn on length, never auto-reject).
- Redis is not required for the first deployment.
- MVP behavior is frozen in `docs/PRODUCT_SPEC.md` (M1): duplicates allowed,
  nickname rules, active-entry limit, deterministic round ordering, sessions not
  tied to a browser connection.
- Async SQLAlchemy + asyncpg; self-contained SQLite test suite; dev PostgreSQL via
  Docker Compose; stdlib JSON logging (M2, DECISIONS D21–D24).
- Host auth: email/password + bcrypt, opaque revocable bearer tokens hashed at rest
  (D25); business API base path `/api/v1` confirmed, health endpoints stay at root
  (M3, DECISIONS D25–D26).
- Sessions (M4): unambiguous 6-char unique join codes (D27), join URL derived from
  `KARAOKE_PUBLIC_BASE_URL` and never stored (D28), cross-host access returns 404
  and state transitions are strict server-side (D29), FastAPI 0.141.1
  dependency-name collision workaround (D30).
- Public join (M5): participants are session-scoped identities with opaque tokens
  hashed at rest and case-insensitive per-session nickname uniqueness (D31); QR
  codes are generated server-side as SVG encoding the join URL (D32).
- YouTube previews (M6): metadata comes from the YouTube Data API v3 with
  `KARAOKE_YOUTUBE_API_KEY` (D33); long videos warn but are never auto-rejected,
  threshold configurable via `KARAOKE_YOUTUBE_LONG_VIDEO_SECONDS` (D34).
- No user-visible feature in M0 beyond a health check.

## 12. Commands for running / testing

See `docs/RUNBOOK.md`. Short version:

```bash
# Database (local PostgreSQL via Docker Compose)
docker compose up -d db

# Backend
cd backend
uv sync
uv run alembic upgrade head                  # apply migrations
uv run uvicorn app.main:app --reload         # http://localhost:8000
uv run pytest                                # tests (SQLite, no Docker needed)
uv run pyright                               # static type check

# Frontend
cd frontend
npm install
npm run dev                                  # starts Vite dev server
npm run build                                # production build
npm run typecheck                            # tsc --noEmit
```

## 13. Things explicitly NOT to build (v1 non-goals)

- Spotify integration, song streaming service, custom karaoke music hosting
- AI recommendations / AI singing analysis
- Voting, leaderboards, payments/tipping
- Public/multi-venue management, public discovery of sessions
- Microservices, Kubernetes, Kafka, RabbitMQ, event sourcing
- Complex analytics, social profiles

These may be reconsidered only after the real school deployment proves the core product.

## 14. Agent rules reminder

- Work on `dev`. Never commit directly to `master`.
- Implement only the assigned milestone; no scope creep.
- Python typing rules (Pydantic v2 at boundaries, `Enum` for states, explicit types,
  static checks passing) apply to every milestone.
- At milestone completion: tests pass, docs updated, acceptance criteria verified.
