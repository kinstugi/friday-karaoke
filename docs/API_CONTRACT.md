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

## 3. Sessions (M4)

| Method | Path                  | Auth | Description                    |
| ------ | --------------------- | ---- | ------------------------------ |
| POST   | /sessions             | host | Create session                |
| GET    | /sessions/{id}        | host | Get session                   |
| POST   | /sessions/{id}/start  | host | Start session                 |
| POST   | /sessions/{id}/end    | host | End session                   |

Session creation returns `id`, `joinCode`, and a QR-friendly join URL.

## 4. Public join (M5)

| Method | Path                          | Auth | Description                        |
| ------ | ----------------------------- | ---- | ---------------------------------- |
| GET    | /join/{joinCode}              | none | Look up session by join code       |
| POST   | /join/{joinCode}/participants | none | Register participant + nickname    |

Participant registration returns an opaque participant token and the session
snapshot. No participant account exists.

## 5. Songs / queue (M6, M7)

| Method | Path                                     | Auth        | Description                              |
| ------ | ---------------------------------------- | ----------- | ---------------------------------------- |
| POST   | /sessions/{id}/entries/preview           | participant | Validate URL + return metadata preview   |
| POST   | /sessions/{id}/entries                   | participant | Submit song (create queue entry)         |
| GET    | /sessions/{id}/entries                   | none        | Queue snapshot (public, sanitized)       |
| DELETE | /entries/{entryId}                       | participant | Cancel own WAITING entry                 |
| PATCH  | /entries/{entryId}/video                 | host        | Host replaces the YouTube URL            |
| DELETE | /entries/{entryId}                       | host        | Host removes any entry                   |

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
