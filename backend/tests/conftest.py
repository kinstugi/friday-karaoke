"""Pytest fixtures and environment setup.

The test suite is self-contained: it runs against an in-memory SQLite
database (via ``KARAOKE_DATABASE_URL``) so no PostgreSQL is required. The
environment variables are set before the application is imported so the
cached settings and the global engine pick them up.
"""

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

# The test suite is self-contained: it runs against an in-memory SQLite
# database. These are hard assignments (not setdefault) so that a developer's
# exported KARAOKE_* shell variables or a local backend/.env file cannot leak
# into the test run — real environment variables take precedence over dotenv
# values in pydantic-settings.
os.environ["KARAOKE_ENVIRONMENT"] = "test"
os.environ["KARAOKE_LOG_LEVEL"] = "WARNING"
os.environ["KARAOKE_DATABASE_URL"] = "sqlite+aiosqlite://"
os.environ["KARAOKE_DEBUG"] = "false"

from app.core.database import SessionFactory  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    """A TestClient bound to the application with the SQLite engine."""
    return TestClient(app)


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """An async database session against the in-memory SQLite database."""
    async with SessionFactory() as test_session:
        yield test_session
