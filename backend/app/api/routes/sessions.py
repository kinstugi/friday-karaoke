"""Karaoke session endpoints (M4).

All session endpoints require a host bearer token (``get_current_host``) and
are scoped to the session's owning host (decision D29). Base path confirmed at
M3 (D26): business endpoints live under ``/api/v1``.

- ``POST /api/v1/sessions``           create a session (host)
- ``GET  /api/v1/sessions/{id}``      get a session (owning host)
- ``POST /api/v1/sessions/{id}/start`` start a session (owning host)
- ``POST /api/v1/sessions/{id}/end``  end a session (owning host)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_host
from app.core.config import get_settings
from app.core.database import get_session
from app.models.host import Host
from app.models.session import Session
from app.schemas.session import SessionCreateRequest, SessionResponse
from app.services.session import (
    InvalidSessionTransitionError,
    SessionNotFoundError,
    session_service,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


def _join_url(join_code: str) -> str:
    """Build the QR-friendly join URL for a session's join code."""
    base_url = get_settings().public_base_url.rstrip("/")
    return f"{base_url}/join/{join_code}"


def _session_to_response(session: Session) -> SessionResponse:
    """Explicit mapping from the ORM model to the API schema."""
    return SessionResponse(
        id=session.id,
        name=session.name,
        join_code=session.join_code,
        join_url=_join_url(session.join_code),
        status=session.status,
        created_at=session.created_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateRequest,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SessionResponse:
    """Create a karaoke session owned by the authenticated host."""
    karaoke = await session_service.create(session, current_host.id, payload.name)
    return _session_to_response(karaoke)


@router.get("/{session_id}", response_model=SessionResponse)
async def session_detail(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SessionResponse:
    """Return a session owned by the authenticated host.

    NOTE: named ``session_detail`` (not ``get_session``) on purpose. FastAPI
    0.141 resolves some sub-dependencies by function ``__name__``; a GET
    endpoint literally named ``get_session`` collides with the
    ``app.core.database.get_session`` dependency and breaks ``/start`` and
    ``/end`` routes (see DECISIONS D30).
    """
    try:
        karaoke = await session_service.get_for_host(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    return _session_to_response(karaoke)


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SessionResponse:
    """Start a session (``CREATED -> ACTIVE``)."""
    try:
        karaoke = await session_service.start(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except InvalidSessionTransitionError as exc:
        raise _conflict(str(exc)) from exc
    return _session_to_response(karaoke)


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: uuid.UUID,
    current_host: Annotated[Host, Depends(get_current_host)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SessionResponse:
    """End a session (any non-terminal state -> ``ENDED``)."""
    try:
        karaoke = await session_service.end(session, current_host.id, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    except InvalidSessionTransitionError as exc:
        raise _conflict(str(exc)) from exc
    return _session_to_response(karaoke)


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="session not found"
    )


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
