"""Typed realtime event payloads (M10).

WebSockets are a delivery mechanism, not the source of truth (decision D5):
the backend broadcasts these events to a session's subscribers after a domain
change, and a reconnecting client must re-fetch authoritative state from the
REST API. Event payloads carry typed fields only — never free-form strings
(API_CONTRACT §8).

M10 emits the events that correspond to domain changes that already exist:
- ``QueueUpdated``       queue mutated (submit, cancel, remove, edit) — the
                         payload is the full authoritative queue snapshot
- ``ParticipantJoined``  a new participant registered in the session
- ``SessionUpdated``     session status changed (started/ended today; paused/
                         resumed and rounds land in later milestones)

The other events listed in API_CONTRACT §8 (SingerStarted, RoundCompleted,
SessionPaused, …) are not emitted until their milestone creates the code paths
that produce them (M11/M13/M14/M16).
"""

import uuid
from typing import Union

from pydantic import BaseModel

from app.domain.session import SessionStatus
from app.schemas.queue import QueueSnapshotResponse


class QueueUpdatedEvent(BaseModel):
    """Broadcast whenever the session's queue changes.

    ``snapshot`` is the full authoritative ``QueueSnapshotResponse`` so every
    subscriber can render the same state the REST snapshot would return.
    """

    type: str = "QueueUpdated"
    session_id: uuid.UUID
    snapshot: QueueSnapshotResponse


class ParticipantJoinedEvent(BaseModel):
    """Broadcast when a participant registers in the session (M5 join flow)."""

    type: str = "ParticipantJoined"
    session_id: uuid.UUID
    nickname: str


class SessionUpdatedEvent(BaseModel):
    """Broadcast when the session status changes (M4 start/end, later pause…)."""

    type: str = "SessionUpdated"
    session_id: uuid.UUID
    status: SessionStatus


#: The union of events the hub may deliver (typed, discriminated by ``type``).
RealtimeEvent = Union[QueueUpdatedEvent, ParticipantJoinedEvent, SessionUpdatedEvent]
