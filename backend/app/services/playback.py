"""Playback use-cases (M11).

The playback state machine is host-driven for now (M12 embeds the host player,
M13 adds timer-driven automatic transitions). M11 gives the host the controls to
drive the queue's playback lifecycle:

- ``start``  promotes the front of the active queue to ``SINGING``
- ``skip``   marks the current ``SINGING`` entry ``SKIPPED`` and advances
- ``finish`` marks the current ``SINGING`` entry ``COMPLETED`` and advances

Advancing promotes the next non-terminal entry of the current round to ``NEXT``
and, because the active round is derived (M10.1/D43), automatically crosses into
the next round when the current one is exhausted. Playback state itself is
*derived* (``PLAYING`` iff something is ``SINGING``, decision D46) — it is never
stored, so it cannot drift from the queue.

Pause/resume are session-state transitions (``ACTIVE <-> PAUSED``) and live in
``SessionService`` (M11 exposes them under the ``/play`` routes).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.queue_entry import QueueEntryStatus
from app.domain.session import SessionStatus
from app.models.queue_entry import QueueEntry
from app.models.session import Session
from app.services.queue import queue_service
from app.services.session import SessionNotFoundError, session_service


class SessionEndedError(Exception):
    """Raised when a playback action targets an ended session."""


class NothingToPlayError(Exception):
    """Raised when starting playback with an empty active queue."""


class AlreadyPlayingError(Exception):
    """Raised when starting a song while one is already ``SINGING``."""


class NothingPlayingError(Exception):
    """Raised when skipping/finishing with no ``SINGING`` entry."""


class PlaybackService:
    """Application service for host-driven playback (M11)."""

    async def start(
        self, session: AsyncSession, host_id: uuid.UUID, session_id: uuid.UUID
    ) -> QueueEntry:
        """Promote the front of the active queue to ``SINGING``.

        Raises ``NothingToPlayError`` (empty queue), ``AlreadyPlayingError``
        (already singing), or ``SessionEndedError``.
        """
        await self._require_playable(session, host_id, session_id)
        active = await queue_service.get_active_entries(session, session_id)
        if not active:
            raise NothingToPlayError("the queue is empty")
        current = active[0]
        if current.status is QueueEntryStatus.SINGING:
            raise AlreadyPlayingError("a song is already playing")
        current.status = QueueEntryStatus.SINGING
        current.started_at = datetime.now(timezone.utc)
        await session.commit()
        return current

    async def skip(
        self, session: AsyncSession, host_id: uuid.UUID, session_id: uuid.UUID
    ) -> QueueEntry:
        """Mark the current singer ``SKIPPED`` and advance immediately (D20)."""
        return await self._advance(session, host_id, session_id, QueueEntryStatus.SKIPPED)

    async def finish(
        self, session: AsyncSession, host_id: uuid.UUID, session_id: uuid.UUID
    ) -> QueueEntry:
        """Mark the current singer ``COMPLETED`` and advance immediately (D20)."""
        return await self._advance(
            session, host_id, session_id, QueueEntryStatus.COMPLETED
        )

    async def _advance(
        self,
        session: AsyncSession,
        host_id: uuid.UUID,
        session_id: uuid.UUID,
        terminal: QueueEntryStatus,
    ) -> QueueEntry:
        await self._require_playable(session, host_id, session_id)
        active = await queue_service.get_active_entries(session, session_id)
        current = next(
            (e for e in active if e.status is QueueEntryStatus.SINGING), None
        )
        if current is None:
            raise NothingPlayingError("no song is currently playing")
        current.status = terminal
        current.ended_at = datetime.now(timezone.utc)
        await session.commit()
        await self._promote_next(session, session_id)
        return current

    async def _promote_next(
        self, session: AsyncSession, session_id: uuid.UUID
    ) -> None:
        """Promote the new front of the active queue to ``NEXT``.

        Runs after the current entry becomes terminal, so it also crosses into
        the next round automatically when the current round is exhausted (M10.1).
        """
        remaining = await queue_service.get_active_entries(session, session_id)
        if remaining:
            remaining[0].status = QueueEntryStatus.NEXT
            await session.commit()

    async def _require_playable(
        self, session: AsyncSession, host_id: uuid.UUID, session_id: uuid.UUID
    ) -> Session:
        """Return the host's session, rejecting ended sessions (no existence
        leak: unknown/other-host sessions raise ``SessionNotFoundError``)."""
        karaoke = await session_service.get_for_host(session, host_id, session_id)
        if karaoke.status is SessionStatus.ENDED:
            raise SessionEndedError("this karaoke night has ended")
        return karaoke


playback_service = PlaybackService()
