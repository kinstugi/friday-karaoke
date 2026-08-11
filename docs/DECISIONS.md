# DECISIONS.md — Friday Karaoke

Architectural and product decisions, with rationale. Each entry records what was
decided, why, and (where relevant) the rejected alternatives. New decisions should
be appended as the project evolves.

---

## D1. Modular monolith backend

- **Status:** Accepted (v1)
- **Decision:** One FastAPI backend application. No microservices, Kafka, RabbitMQ,
  Kubernetes, CQRS, or event sourcing.
- **Rationale:** A single school karaoke night is a small, mostly single-host
  workload. Distributed infrastructure adds operational cost without solving a real
  problem. The backend is layered internally (api/core/domain/services/repositories)
  so it can be split later if a concrete requirement appears.
- **Rejected:** Microservices from day one; event sourcing; message broker.

## D2. Backend is the single source of truth

- **Status:** Accepted
- **Decision:** The backend/database is authoritative for queue order, current
  singer, round state, playback state, permissions, participant identity, and
  session state. The frontend renders state and never owns it.
- **Rationale:** Multiple participants + one host + flaky school WiFi means clients
  must be able to resync from a trusted source. This also keeps the client simple.
- **Rejected:** Client-owned or locally-merged queue state.

## D3. Host is the final authority

- **Status:** Accepted
- **Decision:** Normal operation is automated, but the host can always remove entries,
  edit YouTube URLs, skip singers, pause/resume, manually advance, and end the session.
- **Rationale:** The host is responsible for what happens in the room. Automation
  reduces their workload but must never block recovery from a bad submission
  (e.g., a 3-hour podcast).

## D4. Host browser is the playback device

- **Status:** Accepted
- **Decision:** The host dashboard embeds the YouTube player and is connected to the
  school's screen/speakers. Participant devices never play audio.
- **Rationale:** Avoiding cross-device playback synchronization entirely. Also means
  participants' phones are only used for queueing.
- **Implication:** Browser autoplay policies may require host interaction before
  audio starts; the UI must be designed around this (M12/M13).

## D5. WebSockets are delivery, not truth

- **Status:** Accepted
- **Decision:** FastAPI WebSockets push typed domain events to clients. Reconnecting
  clients must re-fetch authoritative state from the REST API.
- **Rationale:** Events are denormalized notifications; the authoritative source is
  the database. This makes realtime failures survivable and avoids distributed-state
  bugs.

## D6. Participants are session-scoped identities, not accounts

- **Status:** Accepted
- **Decision:** Hosts have accounts; participants only get a session-scoped identity
  (nickname + opaque token) created when they join a session.
- **Rationale:** Students join by scanning a QR code; requiring accounts would destroy
  the intended UX. Privacy is also improved.

## D7. Do not over-validate YouTube content

- **Status:** Accepted
- **Decision:** Validate that a submitted URL is a supported YouTube URL, extract the
  video ID, fetch metadata where possible, and warn about unusually long videos.
  Never automatically reject for length; do not assume a video is a karaoke track.
- **Rationale:** The host decides whether a submitted video is appropriate. The app
  should make bad submissions recoverable (host edit) rather than blocking valid ones.
- **Rejected:** Auto-rejecting videos over some duration; requiring karaoke-track
  detection.

## D8. Queue order by creation, not position fields

- **Status:** Accepted
- **Decision:** Queue ordering is derived from entry creation/order in authoritative
  backend state. No mutable `position` field.
- **Rationale:** Eliminates a whole class of ordering bugs (two participants
  incrementing the same counter, reorder races). Position is computed when rendered.

## D9. Redis not required for first deployment

- **Status:** Accepted
- **Decision:** No Redis in the initial architecture.
- **Rationale:** Requirements (queue, session state, realtime fan-out) are served by
  PostgreSQL + FastAPI for the expected scale of one Friday night. Add Redis only if
  a concrete requirement (e.g., cross-process fan-out) appears.

## D10. Session contains multiple rounds

- **Status:** Accepted
- **Decision:** A Session contains multiple Rounds. A new session (and new QR code)
  is NOT created for each round.
- **Rationale:** Students scan once and stay for the whole night; rounds are a
  within-session lifecycle concept.

## D11. Default next-round answer is YES

- **Status:** Accepted
- **Decision:** At round completion, participants are asked whether they want the next
  round. If they do nothing, the answer is YES.
- **Rationale:** The karaoke night flows with minimal friction; someone who wants out
  must explicitly say NO. (Disconnected participants get a cleanup strategy later.)

## D12. Tooling choices

- **Status:** Accepted
- **Decision:** uv for dependency management; Pydantic v2 for validation/settings;
  SQLAlchemy 2.x + Alembic; Uvicorn; pytest; pyright for static typing.
- **Rationale:** Plan §1.7 specifies this stack. Pyright selected for static checking
  (strong typing, easy CI integration).
- **Rejected:** Poetry (fine, but uv is faster/simpler for this project).

## D13. Project brain documents (M0)

- **Status:** Accepted
- **Decision:** The repository carries `PROJECT_BRAIN.md`, `DEV_BRAIN.md`,
  `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `API_CONTRACT.md`, `DECISIONS.md`, and
  `RUNBOOK.md` under `docs/`.
- **Rationale:** A new coding agent must understand the project without the original
  conversation. These documents persist the context and are updated per milestone.

---

## M1 behavioral decisions (product specification)

These freeze MVP product behavior. They were captured in `docs/PRODUCT_SPEC.md`.

### D14. Frozen product specification document (M1)

- **Status:** Accepted
- **Decision:** `docs/PRODUCT_SPEC.md` is the single behavioral contract for the
  MVP: roles/authority matrix, session and round lifecycles, detailed host and
  participant flows, screen inventory, edge-case catalog, normative behavioral
  rules, and playback/automation behavior.
- **Rationale:** plan.md §M1 requires the flows and business rules to be documented
  clearly enough that another developer can implement them without guessing. One
  canonical document avoids drift between flows/edge cases/rules.

### D15. Duplicate songs are allowed

- **Status:** Accepted
- **Decision:** Two participants may queue the same video. The submitter sees an
  informational notice ("This song is already in the queue") but the entry is never
  blocked.
- **Rationale:** Consistent with "do not over-validate" (D7) — each participant
  queues their own song; blocking duplicates adds friction without a real need.

### D16. Nickname rules

- **Status:** Accepted
- **Decision:** Nicknames are required, trimmed, 1–20 characters, and unique per
  session (case-insensitive). Violations block submission with a clear message.
- **Rationale:** Uniqueness avoids ambiguity on the host dashboard ("two Emmas")
  without requiring participant accounts. Length limits support M17 abuse protection.

### D17. Active-entry limit per participant

- **Status:** Accepted
- **Decision:** A participant may have at most **2 non-terminal entries**
  (WAITING + NEXT + SINGING) in the current round. Further submissions are
  rejected with a clear message.
- **Rationale:** plan.md §M7 requires a reasonable active-entry limit. A concrete
  number avoids implementer guessing; enforcement is hardened in M17.

### D18. Sessions are not tied to a live browser connection

- **Status:** Accepted
- **Decision:** Closing the host's browser (or losing connectivity) does not end or
  pause the session. The session persists in the backend; the host reopens the
  dashboard and re-syncs.
- **Rationale:** Host machines/browsers crash; the backend is the source of truth
  (D2). Tying session lifetime to a socket would make the whole night fragile.

### D19. Round transition behavior

- **Status:** Accepted
- **Decision:** A round completes when the queue has no remaining non-terminal
  entries. The session enters `ROUND_COMPLETE`, the enrollment prompt opens
  (default YES, explicit NO excludes), and the host starts the next round or ends
  the session. Next-round queue order is deterministic: explicit YES answers in
  arrival order, then default-YES participants in creation order, resolved at round
  start.
- **Rationale:** Deterministic, backend-computed ordering avoids races (E19) and
  gives participants an immediate position in the new round.

### D20. Skip vs. manually advance

- **Status:** Accepted
- **Decision:** "Skip" marks the current entry `SKIPPED` and advances immediately;
  "manually advance" marks it `COMPLETED` and advances immediately. Both bypass
  remaining automation. "Pause" holds automation after the current song.
- **Rationale:** Gives the host two distinct, meaningful actions (singer cut short
  vs. singer done early) while keeping the state machine simple and explicit.

---

## M2 backend-skeleton decisions

## D21. Async SQLAlchemy + asyncpg

- **Status:** Accepted
- **Decision:** The database layer uses SQLAlchemy 2.x with the asyncio extension
  and `asyncpg` as the PostgreSQL driver. Sessions are exposed to endpoints through
  a single FastAPI dependency (`app.core.database.get_session`).
- **Rationale:** FastAPI is async-first; blocking the event loop with sync DB calls
  would degrade the realtime features coming in M10+. Async SQLAlchemy is the
  standard, well-supported FastAPI pattern.
- **Rejected:** Sync SQLAlchemy + psycopg2 (simpler but blocks the loop); raw
  asyncpg without an ORM (loses Alembic/metadata tooling).

## D22. Self-contained test database

- **Status:** Accepted
- **Decision:** The automated test suite runs against in-memory SQLite
  (`sqlite+aiosqlite://` with a static pool), configured via the same
  `KARAOKE_DATABASE_URL` settings path. No PostgreSQL is required to run `pytest`.
- **Rationale:** Fresh clones and CI should not require Docker/Postgres to verify
  the skeleton. The engine is built from settings, so the same code path is
  exercised; PostgreSQL is verified manually via the dev compose file and Alembic.
- **Caveat:** SQLite-specific quirks must be watched in M4+ when real models land
  (Postgres-specific types such as UUID/JSONB may need dialect handling).

## D23. Development PostgreSQL via Docker Compose

- **Status:** Accepted
- **Decision:** A root `compose.yaml` provides a Postgres 17 service for local
  development (`docker compose up -d db`). Full production deployment compose
  (frontend + backend + db + reverse proxy) is M20.
- **Rationale:** Local Postgres parity for migrations and manual testing without
  installing a server on the host machine.
- **Rejected:** Testcontainers in the default suite (adds Docker coupling to every
  test run); requiring a locally installed Postgres.

## D24. Structured logging with stdlib JSON formatter

- **Status:** Accepted
- **Decision:** Logging is configured at startup via `app.core.logging` using the
  standard library with a JSON formatter (single-line records to stdout), covering
  the root and uvicorn loggers.
- **Rationale:** Machine-parseable logs for the M20 deployment without adding a
  logging dependency (structlog etc.).
- **Rejected:** structlog (extra dependency, no M2 need); plain text logs
  (unstructured).

---

## M3 host-auth decisions

## D25. Opaque database-backed bearer tokens (hashed at rest)

- **Status:** Accepted
- **Decision:** Hosts authenticate with email/password. Successful login issues an
  opaque random bearer token (`secrets.token_urlsafe`), returned to the client once
  in the login response and sent as `Authorization: Bearer <token>`. Only a SHA-256
  digest of the token is stored (`host_auth_tokens`); the raw token is never
  persisted. Tokens expire (default 30 days, `KARAOKE_AUTH_TOKEN_TTL_DAYS`) and
  logout revokes them by deleting the row. Passwords are bcrypt-hashed
  (`app.core.security`). Emails are stored lowercase; the unique constraint gives
  case-insensitive uniqueness.
- **Rationale:** A real logout and per-token revocation require server-side token
  state; PostgreSQL is already the source of truth (D2). Hashing tokens at rest
  means a database leak does not leak usable credentials. Opaque tokens avoid JWT
  signing-secret management and avoid cookies/CSRF surface in the SPA.
- **Rejected:** JWT (revocation needs a blacklist; signing secret management);
  cookie-based sessions (CSRF considerations, extra cookie handling, no benefit
  here); storing raw tokens in the database (usable on leak); school SSO (no
  identity provider available at the school for v1).

## D26. API base path confirmed: `/api/v1`

- **Status:** Accepted
- **Decision:** Business endpoints live under `/api/v1` (e.g.
  `/api/v1/auth/host/...`). The liveness/readiness endpoints stay at the root
  (`/`, `/health`, `/health/ready`) as they did in M0/M2.
- **Rationale:** `API_CONTRACT.md` deferred the base-path decision to "the first
  real endpoint". M3 is that milestone; a versioned prefix keeps future breaking
  changes manageable without touching operational health checks.
- **Rejected:** Putting auth endpoints at the root alongside the health checks
  (mixed namespacing); `/api` without a version (no upgrade path).

---

## M4 session-creation decisions

## D27. Join codes: short, unambiguous, unique

- **Status:** Accepted
- **Decision:** Every session gets a 6-character uppercase join code drawn from
  the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0`/`O`/`1`/`I`). Codes are
  unique per session (unique index on `sessions.join_code`) and are generated with
  a pre-check + bounded retry (10 attempts) before inserting.
- **Rationale:** A school night has dozens of sessions at most, so 32^6
  combinations make collisions effectively impossible; the pre-check plus the
  unique index is a belt-and-suspenders approach. Excluding confusable characters
  means a student can read the code off a projector or type it reliably. Uppercase
  avoids case-sensitivity confusion (M5 lookup uppercases input).
- **Rejected:** Lowercase/mixed-case codes (case confusion); 4-character codes
  (too few combinations); storing a full random UUID as the join code (too long to
  type).

## D28. Join URL is derived, not stored

- **Status:** Accepted
- **Decision:** The session response includes `join_url =
  {KARAOKE_PUBLIC_BASE_URL}/join/{join_code}`. Only the join code is persisted;
  the URL is computed at the API boundary from the new
  `KARAOKE_PUBLIC_BASE_URL` setting (default `http://localhost:5173`, the Vite
  dev server; set to the deployed frontend in production).
- **Rationale:** The frontend host is deployment-dependent and can change
  without invalidating session data; storing it would go stale. The join code is
  the stable, authoritative identifier — the QR (M5) simply encodes the derived
  URL.
- **Rejected:** Storing `join_url` in the database (redundant, goes stale);
  hard-coding the frontend origin (breaks prod).

## D29. Session ownership + strict state machine

- **Status:** Accepted
- **Decision:** Session endpoints require a host bearer token
  (`get_current_host`, M3) and are scoped to the **owning host**:
  `GET/start/end` on a session that does not exist *or* belongs to another host
  returns `404 session not found` (indistinguishable on purpose). State
  transitions are enforced server-side by the `SessionStatus` state machine
  (`app.domain.session`): `start` only from `CREATED`, `end` from any
  non-terminal state; invalid transitions return `409`.
- **Rationale:** M3's acceptance criterion "another host cannot modify someone
  else's session" needs an enforcement point — 404 avoids leaking that a session
  exists. The state machine makes the documented lifecycle
  (`CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED`) explicit and
  testable, and prevents double-start/double-end corruption.
- **Rejected:** Returning `403` for another host's session (leaks existence);
  idempotent no-op on already-ended sessions (masks state bugs).

## D30. FastAPI 0.141.1 dependency-name collision (bug workaround)

- **Status:** Accepted (workaround for an upstream bug)
- **Decision:** Endpoint functions must never share a `__name__` with a
  dependency function. In M4 the GET endpoint was initially named `get_session`,
  colliding with the `app.core.database.get_session` dependency; on routes with a
  literal suffix after a path parameter (`POST /sessions/{id}/start` and
  `/end`), FastAPI 0.141.1 then invoked the *endpoint* instead of the dependency
  and injected a constructed response-model instance into the dependency
  parameter (500/AttributeError). The endpoint is named `session_detail`.
- **Rationale:** 0.141.1 is the latest FastAPI and the project already depends on
  it (M2/M3 used the same version); no upstream fix is released. The workaround is
  a naming convention — zero API-contract impact (the path is unchanged) and no
  dependency downgrade. Verified with a minimal repro before applying.
- **Rejected:** Downgrading FastAPI (risky project-wide change for a naming
  nit); changing the API contract to avoid `/{id}/start` paths (breaks the frozen
  contract).

---

## Open questions (tracked)

- ~~Authentication mechanism for hosts (email/password vs. school SSO)~~ — **M3
  resolved: email/password + opaque bearer tokens (D25).**
- YouTube metadata source (oEmbed vs. Data API key) — M6.
- Exact realtime payload schemas — M10.
- Web Push service choice — M15.
