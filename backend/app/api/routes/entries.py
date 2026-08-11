"""Song entry endpoints (M6: preview; M7: queue submission).

- ``POST /api/v1/sessions/{session_id}/entries/preview``  validate a YouTube
  URL and return metadata + warnings (participant)

Participant endpoints require the participant's opaque token (M5, D31) and are
scoped to the participant's own session (mismatch -> 404, no existence leak).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_participant
from app.core.config import get_settings
from app.core.database import get_session
from app.domain.session import SessionStatus
from app.models.participant import Participant
from app.schemas.youtube import SongPreviewRequest, SongPreviewResponse
from app.services.session import SessionNotFoundError, session_service
from app.services.youtube import (
    YouTubeServiceConfigurationError,
    YouTubeVideoUnavailableError,
    extract_video_id,
    long_video_warning,
    youtube_service,
)

router = APIRouter(
    prefix="/api/v1/sessions/{session_id}/entries", tags=["entries"]
)


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="session not found"
    )


@router.post("/preview", response_model=SongPreviewResponse)
async def preview_song(
    session_id: uuid.UUID,
    payload: SongPreviewRequest,
    participant: Annotated[Participant, Depends(get_current_participant)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SongPreviewResponse:
    """Validate a YouTube URL and return its metadata + any warning (E3/E4/B6).

    The preview is stateless: nothing is persisted until the participant adds
    the song to the queue (M7).
    """
    # A participant may only preview into their own session.
    if participant.session_id != session_id:
        raise _not_found()
    try:
        karaoke = await session_service.get_by_id(session, session_id)
    except SessionNotFoundError as exc:
        raise _not_found() from exc
    if karaoke.status is SessionStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="this karaoke night has ended",
        )

    video_id = extract_video_id(payload.youtube_url)
    if video_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="that doesn't look like a valid YouTube link",
        )

    try:
        data = await youtube_service.fetch_video_metadata(video_id)
    except YouTubeServiceConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except YouTubeVideoUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="we couldn't load this video",
        ) from exc

    is_long = (
        data.duration_seconds > get_settings().youtube_long_video_seconds
    )
    return SongPreviewResponse(
        youtube_url=data.youtube_url,
        video_id=data.video_id,
        title=data.title,
        channel=data.channel,
        duration_seconds=data.duration_seconds,
        thumbnail_url=data.thumbnail_url,
        is_long=is_long,
        warning=long_video_warning(data.duration_seconds) if is_long else None,
    )
