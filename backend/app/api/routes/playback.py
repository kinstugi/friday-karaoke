"""Playback endpoints (M11).

Host-only controls that drive the playback state machine:

- ``POST /api/v1/sessions/{id}/play/start``   promote the front of the queue to ``SINGING``
- ``POST /api/v1/sessions/{id}/play/skip``    mark the current singer ``SKIPPED``, advance (D20)
- ``POST /api/v1/sessions/{id}/play/finish``  mark the current singer ``COMPLETED``, advance (D20)
- ``POST /api/v1/sessions/{id}/play/pause``   hold automatic progression (``ACTIVE -> PAUSED``)
- ``POST /api/v1/sessions/{id}/play/resume``  resume progression (``PAUSED -> ACTIVE``)

Every endpoint returns the authoritative queue snapshot (which includes the
derived ``playback_state``), and the routes broadcast the matching realtime
events (singer events for start/skip/finish; ``SessionUpdated`` for
pause/resume) plus a ``QueueUpdated`` snapshot.

Endpoint function names are intentionally distinct from any dependency (D30).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_host
from app.core.database import get_session
from app.models.host import Host
from app.realtime.hub import realtime_hub
from app.schemas.queue import QueueSnapshotResponse
from app.schemas.realtime import (
    QueueUpdatedEvent,
    SessionUpdatedEvent,
    SingerFinishedEvent,
    SingerSkippedEvent,
    SingerStartedEvent,
)
from app.services.playback import (
    AlreadyPlayingError,
    NothingPlayingError,
    NothingToPlayError,
    SessionEndedError,
    playback_service,
)
from app.services.queue import queue_service
from app.services.session import (
    InvalidSessionTransitionError,
    SessionNotFoundError,
    session_service,
)

router = APIRouter(prefix="/api/v1/sessions/{session_id}/play", tags=["playback"])


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="session not found"
    )


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@router.post("/start", response_model=QueueSnapshotResponse)
async def start_playback(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueueSnapshotResponse:
    """Start playing the front of the active queue (→ ``SINGING``, M11)."""
    try:
        entry = await playback_service.start(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except (NothingToPlayError, AlreadyPlayingError, SessionEndedError) as exc:
        raise _conflict(str(exc)) from exc
    snapshot = await queue_service.snapshot(session, session_id)
    await realtime_hub.broadcast(
        session_id,
        SingerStartedEvent(
            session_id=session_id,
            entry_id=entry.id,
            participant_name=entry.participant.nickname,
            title=entry.youtube_video.title,
        ),
    )
    await realtime_hub.broadcast(
        session_id, QueueUpdatedEvent(session_id=session_id, snapshot=snapshot)
    )
    return snapshot


@router.post("/skip", response_model=QueueSnapshotResponse)
async def skip_playback(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueueSnapshotResponse:
    """Skip the current singer (→ ``SKIPPED``) and advance (D20, M11)."""
    try:
        entry = await playback_service.skip(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except (NothingPlayingError, SessionEndedError) as exc:
        raise _conflict(str(exc)) from exc
    snapshot = await queue_service.snapshot(session, session_id)
    await realtime_hub.broadcast(
        session_id,
        SingerSkippedEvent(session_id=session_id, entry_id=entry.id),
    )
    await realtime_hub.broadcast(
        session_id, QueueUpdatedEvent(session_id=session_id, snapshot=snapshot)
    )
    return snapshot


@router.post("/finish", response_model=QueueSnapshotResponse)
async def finish_playback(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueueSnapshotResponse:
    """Finish the current singer (→ ``COMPLETED``) and advance (D20, M11)."""
    try:
        entry = await playback_service.finish(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except (NothingPlayingError, SessionEndedError) as exc:
        raise _conflict(str(exc)) from exc
    snapshot = await queue_service.snapshot(session, session_id)
    await realtime_hub.broadcast(
        session_id,
        SingerFinishedEvent(session_id=session_id, entry_id=entry.id),
    )
    await realtime_hub.broadcast(
        session_id, QueueUpdatedEvent(session_id=session_id, snapshot=snapshot)
    )
    return snapshot


@router.post("/pause", response_model=QueueSnapshotResponse)
async def pause_playback(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueueSnapshotResponse:
    """Hold automatic progression (``ACTIVE -> PAUSED``, M11/E22)."""
    try:
        karaoke = await session_service.pause(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except InvalidSessionTransitionError as exc:
        raise _conflict(str(exc)) from exc
    snapshot = await queue_service.snapshot(session, session_id)
    await realtime_hub.broadcast(
        session_id,
        SessionUpdatedEvent(session_id=session_id, status=karaoke.status),
    )
    return snapshot


@router.post("/resume", response_model=QueueSnapshotResponse)
async def resume_playback(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> QueueSnapshotResponse:
    """Resume progression (``PAUSED -> ACTIVE``, M11)."""
    try:
        karaoke = await session_service.resume(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except InvalidSessionTransitionError as exc:
        raise _conflict(str(exc)) from exc
    snapshot = await queue_service.snapshot(session, session_id)
    await realtime_hub.broadcast(
        session_id,
        SessionUpdatedEvent(session_id=session_id, status=karaoke.status),
    )
    return snapshot
