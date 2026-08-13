"""Pydantic schemas for the session API (M4; transition timings at M13)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.playback import PlaybackState
from app.domain.session import SessionStatus


class SessionCreateRequest(BaseModel):
    """Request body for ``POST /api/v1/sessions``.

    ``name`` is optional; the service falls back to
    ``Friday Karaoke - <server-local date>`` when omitted or blank.
    ``cooldown_seconds``/``countdown_seconds`` override the automatic-transition
    timings (M13, PRODUCT_SPEC §10); defaults come from settings.
    """

    name: str | None = Field(default=None, max_length=100)
    cooldown_seconds: int | None = Field(default=None, ge=0, le=3600)
    countdown_seconds: int | None = Field(default=None, ge=0, le=3600)


class SessionResponse(BaseModel):
    """Host-facing view of a session."""

    id: uuid.UUID
    name: str
    join_code: str
    join_url: str
    status: SessionStatus
    playback_state: PlaybackState
    cooldown_seconds: int
    countdown_seconds: int
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None
