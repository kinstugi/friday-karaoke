# API_CONTRACT.md — Friday Karaoke

Planned API surface for v1. **Status: PLANNED.** No endpoints are implemented in M0
(the backend serves only a health check). Endpoints will be implemented milestone by
milestone and this document will be updated to reflect reality.

All structured request/response bodies are Pydantic v2 models. Domain states use
Python `Enum` types, never free-form strings. `id`s are UUIDs.

---

## Conventions

- Base path: `/api/v1` (to be confirmed when the first real endpoint lands).
- JSON bodies; `application/json`.
- Errors use a consistent shape (to be defined with the first endpoint):

```text
{"detail": "<human-readable message>"}
```

- Auth:
  - Host endpoints require host authentication (M3).
  - Participant endpoints require the participant's opaque token (M5).
- Responses shown below are target shapes and may evolve.

## 1. Health (M0)

| Method | Path      | Auth | Description        |
| ------ | --------- | ---- | ------------------ |
| GET    | /health   | none | Liveness check     |
| GET    | /         | none | Service identity   |

```text
200 { "service": "friday-karaoke-backend", "status": "ok", "version": "0.1.0" }
```

## 2. Host auth (M3)

| Method | Path                 | Auth | Description            |
| ------ | -------------------- | ---- | ---------------------- |
| POST   | /auth/host/register  | none | Create host account    |
| POST   | /auth/host/login     | none | Host login             |
| POST   | /auth/host/logout    | host | Logout                 |

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
