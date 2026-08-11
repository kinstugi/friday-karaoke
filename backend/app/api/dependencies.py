"""FastAPI dependencies shared by host-authenticated endpoints."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models.host import Host
from app.services.host_auth import host_auth_service

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
