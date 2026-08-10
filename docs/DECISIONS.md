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

## Open questions (tracked)

- Authentication mechanism for hosts (email/password vs. school SSO) — M3.
- YouTube metadata source (oEmbed vs. Data API key) — M6.
- Exact realtime payload schemas — M10.
- Web Push service choice — M15.
