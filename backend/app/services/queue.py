"""Queue management use-cases (M7).

The authoritative queue engine: submissions (with the active-entry limit and
duplicate notice), public snapshots with computed positions, participant
cancellation, and host removal/URL editing. Ordering is derived from entry
creation (decision D8) — no mutable position field.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.queue_entry import QueueEntryStatus
from app.models.participant import Participant
from app.models.queue_entry import QueueEntry
from app.models.round import Round
from app.models.session import Session
from app.models.youtube_video import YouTubeVideo
from app.schemas.youtube import YouTubeVideoData
from app.services.session import SessionNotFoundError, session_service

#: Maximum non-terminal entries per participant per round (B15/D17).
ACTIVE_ENTRY_LIMIT = 2

#: Informational notice for a duplicate song (B16/D15 — never a block).
DUPLICATE_NOTICE = "This song is already in the queue."


class ActiveEntryLimitError(Exception):
    """Raised when a participant already has the max active entries (B15)."""


class EntryNotFoundError(Exception):
    """Raised when an entry does not exist or the actor cannot act on it."""


class EntryNotCancellableError(Exception):
    """Raised when a participant tries to cancel an entry that is not WAITING."""


class QueueService:
    """Application service for the queue."""

    async def submit(
        self,
        session: AsyncSession,
        participant: Participant,
        data: YouTubeVideoData,
    ) -> tuple[QueueEntry, bool]:
        """Create a WAITING entry in the current round.

        Returns ``(entry, duplicate)`` where ``duplicate`` is True when the
        same video is already queued in the round (informational only, B16).
        Raises ``ActiveEntryLimitError`` at the per-round limit (B15/D17).
        """
        karaoke_round = await self._current_round(session, participant.session_id)

        active_count = await session.scalar(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.round_id == karaoke_round.id,
                QueueEntry.participant_id == participant.id,
                QueueEntry.status.in_(QueueEntryStatus.non_terminal()),
            )
        )
        if (active_count or 0) >= ACTIVE_ENTRY_LIMIT:
            raise ActiveEntryLimitError(
                f"you already have {ACTIVE_ENTRY_LIMIT} active songs in this round"
            )

        duplicate = (
            await session.scalar(
                select(QueueEntry.id)
                .join(YouTubeVideo, QueueEntry.youtube_video_id == YouTubeVideo.id)
                .where(
                    QueueEntry.round_id == karaoke_round.id,
                    QueueEntry.status.in_(QueueEntryStatus.non_terminal()),
                    YouTubeVideo.youtube_video_id == data.video_id,
                )
            )
        ) is not None

        video = await self._get_or_create_video(session, data)
        entry = QueueEntry(
            session_id=participant.session_id,
            round_id=karaoke_round.id,
            participant_id=participant.id,
            youtube_video_id=video.id,
            status=QueueEntryStatus.WAITING,
        )
        session.add(entry)
        await session.commit()
        return await self.get_entry(session, entry.id), duplicate

    async def get_active_entries(
        self, session: AsyncSession, session_id: uuid.UUID
    ) -> list[QueueEntry]:
        """Return the current round's non-terminal entries in queue order.

        Ordered by (created_at, id): creation order with a deterministic
        tie-break (E19).
        """
        karaoke_round = await self._current_round(session, session_id)
        result = await session.scalars(
            select(QueueEntry)
            .where(
                QueueEntry.round_id == karaoke_round.id,
                QueueEntry.status.in_(QueueEntryStatus.non_terminal()),
            )
            .order_by(QueueEntry.created_at, QueueEntry.id)
        )
        return list(result)

    async def get_entry(
        self, session: AsyncSession, entry_id: uuid.UUID
    ) -> QueueEntry:
        """Return an entry (relationships loaded), or raise ``EntryNotFoundError``."""
        entry = await session.scalar(
            select(QueueEntry).where(QueueEntry.id == entry_id)
        )
        if entry is None:
            raise EntryNotFoundError(entry_id)
        return entry

    async def cancel(
        self,
        session: AsyncSession,
        participant: Participant,
        entry_id: uuid.UUID,
    ) -> None:
        """Cancel the participant's own WAITING entry (B3)."""
        entry = await self.get_entry(session, entry_id)
        if (
            entry.session_id != participant.session_id
            or entry.participant_id != participant.id
        ):
            raise EntryNotFoundError(entry_id)
        if entry.status is not QueueEntryStatus.WAITING:
            raise EntryNotCancellableError(
                f"only WAITING entries can be cancelled, not {entry.status.value}"
            )
        entry.status = QueueEntryStatus.CANCELLED
        entry.ended_at = datetime.now(timezone.utc)
        await session.commit()

    async def remove(
        self, session: AsyncSession, host_id: uuid.UUID, entry_id: uuid.UUID
    ) -> None:
        """Remove any entry in one of the host's sessions (B4)."""
        entry = await self.get_entry(session, entry_id)
        try:
            await session_service.get_for_host(session, host_id, entry.session_id)
        except SessionNotFoundError as exc:
            raise EntryNotFoundError(entry_id) from exc
        entry.status = QueueEntryStatus.REMOVED
        entry.ended_at = datetime.now(timezone.utc)
        await session.commit()

    async def edit_video(
        self,
        session: AsyncSession,
        host_id: uuid.UUID,
        entry_id: uuid.UUID,
        data: YouTubeVideoData,
    ) -> QueueEntry:
        """Replace an entry's video in one of the host's sessions (B4).

        The entry keeps its participant and queue position; the metadata is
        re-fetched by the caller before this is invoked.
        """
        entry = await self.get_entry(session, entry_id)
        try:
            await session_service.get_for_host(session, host_id, entry.session_id)
        except SessionNotFoundError as exc:
            raise EntryNotFoundError(entry_id) from exc
        video = await self._get_or_create_video(session, data)
        entry.youtube_video_id = video.id
        await session.commit()
        # The FK column is already updated, but the selectin-loaded
        # ``youtube_video`` relationship is stale in the identity map; refresh
        # it so the returned entry reflects the new metadata.
        await session.refresh(entry, attribute_names=["youtube_video"])
        return entry

    async def _current_round(
        self, session: AsyncSession, session_id: uuid.UUID
    ) -> Round:
        """Return the latest round of a session (round 1 exists per session)."""
        karaoke_round = await session.scalar(
            select(Round)
            .where(Round.session_id == session_id)
            .order_by(Round.number.desc())
            .limit(1)
        )
        if karaoke_round is None:
            raise SessionNotFoundError(session_id)
        return karaoke_round

    async def _get_or_create_video(
        self, session: AsyncSession, data: YouTubeVideoData
    ) -> YouTubeVideo:
        """Return the metadata row for a video id, creating it if unknown.

        Handles the concurrent-insert race on the unique ``youtube_video_id``
        by rolling back and re-selecting the winner.
        """
        existing = await session.scalar(
            select(YouTubeVideo).where(
                YouTubeVideo.youtube_video_id == data.video_id
            )
        )
        if existing is not None:
            return existing
        video = YouTubeVideo(
            youtube_video_id=data.video_id,
            youtube_url=data.youtube_url,
            title=data.title,
            channel=data.channel,
            duration_seconds=data.duration_seconds,
            thumbnail_url=data.thumbnail_url,
        )
        session.add(video)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            existing = await session.scalar(
                select(YouTubeVideo).where(
                    YouTubeVideo.youtube_video_id == data.video_id
                )
            )
            if existing is None:
                raise  # pragma: no cover - unique constraint guarantees a winner
            return existing
        return video


queue_service = QueueService()
