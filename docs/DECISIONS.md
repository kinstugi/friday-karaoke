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

## Open questions (tracked)

- Authentication mechanism for hosts (email/password vs. school SSO) — M3.
- YouTube metadata source (oEmbed vs. Data API key) — M6.
- Exact realtime payload schemas — M10.
- Web Push service choice — M15.
