# API_CONTRACT.md — Friday Karaoke

Planned API surface for v1. **Status: PARTIALLY IMPLEMENTED.** The health
endpoints (M0/M2) and the host auth endpoints (M3) are live; everything else
is planned and will be implemented milestone by milestone. This document is
updated to reflect reality.

All structured request/response bodies are Pydantic v2 models. Domain states use
Python `Enum` types, never free-form strings. `id`s are UUIDs.

---

## Conventions

- **Base path: `/api/v1`** (confirmed at M3, decision D26) for business
  endpoints. The liveness/readiness endpoints stay at the root (`/`, `/health`,
  `/health/ready`).
- JSON bodies; `application/json`.
- Errors use a consistent shape:

```text
{"detail": "<human-readable message>"}
```

- Auth:
  - Host endpoints require host authentication (M3): an opaque **bearer token**
    sent as `Authorization: Bearer <token>`. Tokens are issued by login,
    revocable by logout, and expire (default 30 days, `KARAOKE_AUTH_TOKEN_TTL_DAYS`).
  - Participant endpoints require the participant's opaque token (M5).
- Responses shown below are target shapes and may evolve.

## 1. Health (M0/M2)

| Method | Path            | Auth | Description                            |
| ------ | --------------- | ---- | -------------------------------------- |
| GET    | /               | none | Service identity (liveness)            |
| GET    | /health         | none | Liveness check                         |
| GET    | /health/ready   | none | Readiness: probes the database (200/503)|

```text
GET /health
200 { "service": "friday-karaoke-backend", "status": "ok", "version": "0.1.0" }

GET /health/ready   (database reachable)
200 { "service": "friday-karaoke-backend", "status": "ok", "version": "0.1.0",
      "components": { "database": "ok" } }

GET /health/ready   (database unreachable)
503 { "detail": "database unavailable" }
```

## 2. Host auth (M3) — IMPLEMENTED

| Method | Path                              | Auth | Description            |
| ------ | --------------------------------- | ---- | ---------------------- |
| POST   | /api/v1/auth/host/register        | none | Create host account    |
| POST   | /api/v1/auth/host/login           | none | Host login             |
| POST   | /api/v1/auth/host/logout          | host | Logout (revoke token)  |
| GET    | /api/v1/auth/host/me              | host | Current host profile   |

```text
POST /api/v1/auth/host/register
{ "email": "host@school.edu", "password": "correct-horse-battery" }

201 {
  "id": "d4c7a99f-...",
  "email": "host@school.edu",      # normalized to lowercase
  "created_at": "2026-08-10T22:43:00.507099Z"
}

409 { "detail": "a host with this email already exists" }
422 { "detail": [...] }              # invalid email / short or overlong password
```

```text
POST /api/v1/auth/host/login
{ "email": "host@school.edu", "password": "correct-horse-battery" }

200 {
  "token": "fr5zCS4nGntz3pAGYIMlfyG0vK-5mWuHeS8xXud8_V4",
  "token_type": "bearer",
  "host": { "id": "d4c7a99f-...", "email": "host@school.edu", "created_at": "..." }
}

401 { "detail": "invalid email or password" }   # unknown email and wrong password
                                                # both return the same message
```

```text
POST /api/v1/auth/host/logout        Authorization: Bearer <token>
204                                   # token revoked; idempotent

GET /api/v1/auth/host/me             Authorization: Bearer <token>
200 { "id": "...", "email": "...", "created_at": "..." }
401 { "detail": "invalid or expired token" }   # missing/expired/unknown token
```

Notes (decision D25): tokens are opaque, random strings. Only their SHA-256
digest is stored; a database leak does not expose usable tokens. Passwords are
bcrypt-hashed. Emails are stored lowercase (case-insensitive uniqueness).

## 3. Sessions (M4) — IMPLEMENTED

| Method | Path                       | Auth | Description                    |
| ------ | -------------------------- | ---- | ------------------------------ |
| POST   | /api/v1/sessions           | host | Create session                |
| GET    | /api/v1/sessions/{id}      | host | Get session (owning host)     |
| POST   | /api/v1/sessions/{id}/start| host | Start session (owning host)   |
| POST   | /api/v1/sessions/{id}/end  | host | End session (owning host)     |
| GET    | /api/v1/sessions/{id}/qr   | host | Join URL as SVG QR code (M5)  |

Session creation returns `id`, `name`, `joinCode`, a QR-friendly `joinUrl`, and
`status`. Session state is a `SessionStatus` enum:

```text
CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED
```

`ENDED` is reachable from any other state; `PAUSED`/`ROUND_COMPLETE` are
reachable in later milestones (M14/M16). Invalid transitions return `409`.
Accessing a session that does not exist *or belongs to another host* returns
`404 session not found` (no existence leak, decision D29).

```text
POST /api/v1/sessions                  Authorization: Bearer <token>
{ }                                    # name optional; defaults below
# or { "name": "Spring Concert Night" }

201 {
  "id": "d4c7a99f-...",
  "name": "Friday Karaoke - 2026-08-14",   # default: "Friday Karaoke - <server date>"
  "join_code": "K7X3QP",                   # unambiguous alphabet, 6 chars (D27)
  "join_url": "http://localhost:5173/join/K7X3QP",   # {KARAOKE_PUBLIC_BASE_URL}/join/{code} (D28)
  "status": "CREATED",
  "created_at": "2026-08-10T22:43:00Z",
  "started_at": null,
  "ended_at": null
}

401 { "detail": "authentication required" }     # missing/invalid token
422 { "detail": [...] }                          # name > 100 chars
```

```text
GET /api/v1/sessions/{id}              Authorization: Bearer <token>
200 { ...same shape as above... }
404 { "detail": "session not found" }            # unknown id or another host's session

POST /api/v1/sessions/{id}/start       Authorization: Bearer <token>
200 { ..., "status": "ACTIVE", "started_at": "..." }   # CREATED -> ACTIVE
409 { "detail": "session <id> cannot start from state ACTIVE" }  # already started/ended

POST /api/v1/sessions/{id}/end         Authorization: Bearer <token>
200 { ..., "status": "ENDED", "ended_at": "..." }   # any non-terminal -> ENDED
409 { "detail": "session <id> is already ended" }
```

Notes: only the owning host can get/start/end a session (decision D29). The join
URL is derived from the join code and `KARAOKE_PUBLIC_BASE_URL`; it is never
stored. QR generation (SVG encoding of the join URL) is served at
`GET /api/v1/sessions/{id}/qr` (decision D32); the `/join/{code}` lookup lands in
M5.

## 4. Public join (M5) — IMPLEMENTED

| Method | Path                                 | Auth | Description                        |
| ------ | ------------------------------------ | ---- | ---------------------------------- |
| GET    | /api/v1/join/{joinCode}              | none | Look up session by join code       |
| POST   | /api/v1/join/{joinCode}/participants | none | Register participant + nickname    |

These endpoints are **public** (no bearer token): anyone with the join code can
look up a session and join (rule B2). Participant registration returns an opaque
participant token and the session snapshot. No participant account exists
(decision D6).

```text
GET /api/v1/join/{joinCode}              # joinCode is case-insensitive
200 {
  "id": "d4c7a99f-...",
  "name": "Friday Karaoke - 2026-08-14",
  "status": "CREATED"                    # ENDED is still returned so the UI
}                                        # can show "This karaoke night has ended"
404 { "detail": "session not found" }

POST /api/v1/join/{joinCode}/participants
{ "nickname": "Emma" }                   # required, trimmed, 1-20 chars, unique per session

201 {
  "token": "fr5zCS4nGntz3pAGYIMlfyG0vK-5mWuHeS8xXud8_V4",   # opaque, shown once
  "token_type": "bearer",
  "session": { "id": "...", "name": "...", "status": "CREATED" },
  "participant": { "id": "...", "session_id": "...", "nickname": "Emma",
                   "created_at": "..." }
}
404 { "detail": "session not found" }
409 { "detail": "this karaoke night has ended" }      # ENDED sessions cannot be joined
409 { "detail": "nickname 'emma' is already taken" }  # case-insensitive per session
422 { "detail": [...] }                                # blank/overlong nickname
```

Notes: the nickname rules are B14/D16 (trimmed, 1-20 chars, case-insensitive
uniqueness per session, decision D31). The participant token is hashed at rest
(SHA-256 digest). The QR code (M5, decision D32) encodes the session's join URL
and is served as an SVG at `GET /api/v1/sessions/{id}/qr` (owning host).

## 5. Songs / queue (M6, M7)

| Method | Path                                     | Auth        | Description                              |
| ------ | ---------------------------------------- | ----------- | ---------------------------------------- |
| POST   | /api/v1/sessions/{id}/entries/preview    | participant | Validate URL + return metadata preview (M6 — IMPLEMENTED) |
| POST   | /api/v1/sessions/{id}/entries            | participant | Submit song (create queue entry) (M7)    |
| GET    | /api/v1/sessions/{id}/entries            | none        | Queue snapshot (public, sanitized) (M7)  |
| DELETE | /entries/{entryId}                       | participant | Cancel own WAITING entry (M7)            |
| PATCH  | /entries/{entryId}/video                 | host        | Host replaces the YouTube URL (M7)       |
| DELETE | /entries/{entryId}                       | host        | Host removes any entry (M7)              |

### Preview (M6) — IMPLEMENTED

```text
POST /api/v1/sessions/{id}/entries/preview   Authorization: Bearer <participant token>
{ "youtube_url": "https://youtu.be/dQw4w9WgXcQ" }   # watch / youtu.be / embed / shorts

200 {
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # canonical
  "video_id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "channel": "Rick Astley",
  "duration_seconds": 213,
  "thumbnail_url": "https://i.ytimg.com/vi/medium.jpg",
  "is_long": false,                      # true when > KARAOKE_YOUTUBE_LONG_VIDEO_SECONDS (D34)
  "warning": null                        # "This video is unusually long (...)" when is_long
}

401 { "detail": "authentication required" }             # missing/invalid participant token
404 { "detail": "session not found" }                    # unknown session or token from another session
409 { "detail": "this karaoke night has ended" }         # ENDED sessions cannot preview
422 { "detail": "that doesn't look like a valid YouTube link" }   # E3: malformed/non-YouTube URL
404 { "detail": "we couldn't load this video" }          # E4: valid format, metadata unavailable
503 { "detail": "KARAOKE_YOUTUBE_API_KEY is not configured" }    # service unconfigured (D33)
```

The preview is stateless (nothing persisted until M7). Metadata source is the
YouTube Data API v3 (decision D33); long videos warn but are never rejected
(rule B6, decision D34). The participant token must belong to the session in
the path.

Target request/response example:

```text
POST /sessions/{id}/entries
{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}

201 {
  "id": "8f2b...",
  "participantName": "Alice",
  "songTitle": "...",
  "channel": "...",
  "durationSeconds": 212,
  "status": "WAITING",
  "position": 3
}
```

## 6. Playback + moderation (M9, M14)

| Method | Path                       | Auth | Description             |
| ------ | -------------------------- | ---- | ----------------------- |
| POST   | /sessions/{id}/play/start  | host | Start current song      |
| POST   | /sessions/{id}/play/skip   | host | Skip current singer     |
| POST   | /sessions/{id}/play/pause  | host | Pause automatic progression |
| POST   | /sessions/{id}/play/resume | host | Resume progression      |
| POST   | /sessions/{id}/next        | host | Manually advance queue  |

## 7. Rounds (M16)

| Method | Path                          | Auth | Description                    |
| ------ | ----------------------------- | ---- | ------------------------------ |
| POST   | /rounds/{roundId}/enroll      | participant | Yes/No for next round   |
| POST   | /sessions/{id}/rounds/start   | host | Start next round               |

## 8. Realtime (WebSocket, M10)

- Host stream: `/ws/sessions/{id}?token=<host>`
- Participant stream: `/ws/sessions/{id}?token=<participant>`

Events are typed domain events (delivery only, never authoritative):

```text
QueueUpdated
SingerStarted
SingerFinished
SingerSkipped
ParticipantJoined
ParticipantRemoved
RoundStarted
RoundCompleted
SessionPaused
SessionResumed
```

Rules:

- WebSockets are a delivery mechanism, not the source of truth.
- On reconnect, clients must re-fetch authoritative state via the REST API.
- Event payloads carry typed fields, not free-form strings.

## 9. Queue snapshot shape (target)

```text
{
  "sessionId": "uuid",
  "status": "ACTIVE",
  "currentSinger": { "participantName": "Alice", "songTitle": "...", "entryId": "uuid" },
  "upNext": { "participantName": "Bob", "songTitle": "...", "entryId": "uuid" },
  "queue": [ { "entryId": "uuid", "participantName": "...", "songTitle": "...",
               "status": "WAITING" } ],
  "yourPosition": 3
}
```

Exact shape is finalized when the queue APIs are implemented (M7).
