"""FastAPI dependencies shared by host- and participant-authenticated endpoints."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.host import Host
from app.models.participant import Participant
from app.services.host_auth import host_auth_service
from app.services.participant import participant_service

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_host(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Host:
    """Resolve the authenticated host from the ``Authorization`` header.

    Raises HTTP 401 when the header is missing or the token is unknown,
    expired, or malformed.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    host = await host_auth_service.get_host_by_token(session, credentials.credentials)
    if host is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return host


async def get_current_participant(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Participant:
    """Resolve the participant from their opaque token (M5 tokens, D31).

    Raises HTTP 401 when the header is missing or the token is unknown.
    Session binding is checked by the endpoints that need it (404 on mismatch).
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    participant = await participant_service.get_by_token(
        session, credentials.credentials
    )
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return participant


async def get_host_or_participant(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Host | Participant:
    """Resolve the actor as either a host or a participant (M7).

    Used by shared actions (e.g. ``DELETE /api/v1/entries/{id}``) where the
    same path means "cancel own entry" for a participant and "remove any
    entry" for a host. Raises HTTP 401 when the token matches neither.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    participant = await participant_service.get_by_token(
        session, credentials.credentials
    )
    if participant is not None:
        return participant
    host = await host_auth_service.get_host_by_token(session, credentials.credentials)
    if host is not None:
        return host
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
