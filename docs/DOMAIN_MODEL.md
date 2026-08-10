# DOMAIN_MODEL.md — Friday Karaoke

Domain concepts, entities, states, and relationships. This document is the target
model for v1; persistence schemas (SQLAlchemy) and API schemas (Pydantic) will be
defined in later milestones (M2 onward) and must map to these concepts.

---

## 1. Overview

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

- A **Host** owns Sessions.
- A **Session** is one karaoke night and contains multiple Rounds.
- A **Participant** exists only within a Session (v1). No account.
- A **Round** contains QueueEntries for one pass through the queue.
- A **QueueEntry** references exactly one **YouTubeVideo** and one Participant.

## 2. Entities

### Host

An authenticated account that can create and manage sessions.

```text
id
email             # v1: email/password auth
password_hash
createdAt
```

### Session

One karaoke night.

```text
id
hostId
name              # e.g. "Friday Karaoke - 2026-08-14"
joinCode          # short code for the QR join link
status            # SessionStatus
createdAt
startedAt
endedAt
```

### Participant

A session-scoped identity created when a student joins. **No account.**

```text
id
sessionId
nickname
token            # opaque participant token used for authorization
createdAt
```

### Round

One pass through the queue within a session.

```text
id
sessionId
number           # 1-based round number
status           # RoundStatus (implied by SessionStatus/queue state; formalized in M16)
startedAt
endedAt
```

### QueueEntry

A participant's song in a round.

```text
id
sessionId
roundId
participantId
youtubeVideoId
status            # QueueEntryStatus
createdAt         # determines order (authoritative ordering, no mutable position field)
startedAt
endedAt
```

### YouTubeVideo

Metadata snapshot of a submitted video.

```text
id
youtubeVideoId
youtubeUrl
title
channel
durationSeconds
thumbnailUrl
```

## 3. State enums

### SessionStatus

```text
CREATED          # session exists, not yet started
ACTIVE           # running
PAUSED           # automatic progression paused (host-controlled)
ROUND_COMPLETE   # current round finished; awaiting next-round enrollment
ENDED            # session finished
```

### QueueEntryStatus

```text
WAITING
NEXT             # promoted to sing next
SINGING
COMPLETED
SKIPPED
CANCELLED        # participant withdrew their own entry
REMOVED          # host removed the entry
```

### PlaybackState (backend playback state machine, M11)

```text
IDLE
PREPARING
COUNTDOWN
PLAYING
COOLDOWN
FINISHED
SKIPPED
```

Example normal transition chain:

```text
NEXT
  -> PREPARING
  -> COUNTDOWN
  -> PLAYING
  -> COOLDOWN
  -> NEXT
```

The host can interrupt transitions at any point.

## 4. Round system (target, M16)

- A Session contains multiple Rounds; never create a new session per round.
- When a round's queue is exhausted, the round completes.
- Participants are asked "Join next round?"; default answer is **YES**.
- Explicit **NO** excludes the participant from the next round.
- Disconnected/absent participants should not silently remain forever
  (cleanup strategy defined in a later milestone).

## 5. Business rules that constrain the model

1. A participant can exist only within a session (v1).
2. Queue order is determined by authoritative backend state — the creation order
   of entries, not a mutable position field.
3. A participant may cancel their own WAITING entry.
4. The host may remove any entry and edit the YouTube URL of an entry
   (participant stays in the queue).
5. A participant cannot modify another participant's entry.
6. One participant has a reasonable active-entry limit (enforced later).
7. Invalid YouTube URLs cannot become QueueEntries.
8. Long videos produce a warning, never automatic rejection.
