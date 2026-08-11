"""Friday Karaoke backend application entry point.

M2 status: backend skeleton. Configuration uses Pydantic Settings
(``app.core.config``), logging is structured JSON (``app.core.logging``),
and the database layer is async SQLAlchemy (``app.core.database``).
Business functionality (auth, sessions, queue, playback) arrives in later
milestones.
"""

from fastapi import FastAPI

from app import __version__
from app.api.routes import auth, entries, health, join, sessions
from app.core.config import get_settings
from app.core.logging import setup_logging


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    setup_logging(settings)

    application = FastAPI(
        title=settings.app_name,
        description="Backend for the private school karaoke queue application.",
        version=__version__,
    )
    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(sessions.router)
    application.include_router(join.router)
    application.include_router(entries.router)
    return application


app = create_app()
