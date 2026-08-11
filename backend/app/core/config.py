"""Application configuration via Pydantic Settings.

All configuration is loaded from environment variables prefixed with
``KARAOKE_`` (and optionally from a ``.env`` file in the working directory).
Defaults target local development with the dockerized PostgreSQL from
``compose.yaml``.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings.

    Field names map to environment variables as ``KARAOKE_<FIELD_NAME>``
    (e.g. ``KARAOKE_DATABASE_URL``). Unknown environment variables are ignored.
    """

    model_config = SettingsConfigDict(
        env_prefix="KARAOKE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Friday Karaoke API"
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    database_url: str = "postgresql+asyncpg://karaoke:karaoke@localhost:5432/karaoke"
    #: Lifetime of a host bearer token (M3). Logout revokes it early.
    auth_token_ttl_days: int = 30
    #: Public base URL of the frontend, used to build session join URLs (M4).
    #: Defaults to the Vite dev server; set to the deployed frontend in prod.
    public_base_url: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings singleton."""
    return Settings()
