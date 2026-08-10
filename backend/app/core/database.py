"""Database engine, session factory, and the FastAPI session dependency.

The engine is created once from application settings. SQLAlchemy async
engines connect lazily, so creating the engine never blocks or requires the
database to be reachable; failures surface on first use (e.g. the
``/health/ready`` probe or an actual query).
"""

from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


def build_engine(database_url: str) -> AsyncEngine:
    """Build an async engine for a database URL.

    SQLite (used by the test suite) needs a static pool so every session
    shares the same in-memory database.
    """
    if database_url.startswith("sqlite"):
        return create_async_engine(database_url, poolclass=StaticPool)
    return create_async_engine(database_url, pool_pre_ping=True)


engine = build_engine(get_settings().database_url)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a database session for the request lifetime."""
    async with SessionFactory() as session:
        yield session


async def check_database_connection(session: AsyncSession) -> None:
    """Raise if the database is not reachable (used by readiness probes)."""
    await session.execute(text("SELECT 1"))
