"""SQLAlchemy model for a karaoke session (M4).

A Session is one karaoke night owned by a host (``docs/DOMAIN_MODEL.md``).
The status is stored as the ``SessionStatus`` enum value using a non-native
VARCHAR enum, keeping the schema portable across SQLite tests and PostgreSQL
(decision D22).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.session import SessionStatus
from app.models.base import Base


class Session(Base):
    """One host-owned karaoke session."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    host_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("hosts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    join_code: Mapped[str] = mapped_column(
        String(8), unique=True, index=True, nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, native_enum=False, length=32),
        default=SessionStatus.CREATED,
        server_default="CREATED",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
