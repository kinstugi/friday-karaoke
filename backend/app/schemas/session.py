"""Pydantic schemas for the session API (M4)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.session import SessionStatus


class SessionCreateRequest(BaseModel):
    """Request body for ``POST /api/v1/sessions``.

    ``name`` is optional; the service falls back to
    ``Friday Karaoke - <server-local date>`` when omitted or blank.
    """

    name: str | None = Field(default=None, max_length=100)


class SessionResponse(BaseModel):
    """Host-facing view of a session."""

    id: uuid.UUID
    name: str
    join_code: str
    join_url: str
    status: SessionStatus
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None
