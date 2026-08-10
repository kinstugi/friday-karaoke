"""Friday Karaoke backend application entry point.

M0 status: minimal FastAPI app so the backend can start. Business
functionality (auth, sessions, queue, playback) arrives in later
milestones. The Pydantic response model establishes the
Pydantic-at-API-boundary convention used throughout the project.
"""

from fastapi import FastAPI
from pydantic import BaseModel

from app import __version__

SERVICE_NAME = "friday-karaoke-backend"


class ServiceInfo(BaseModel):
    """Response model for the root and health endpoints."""

    service: str
    status: str
    version: str


app = FastAPI(
    title="Friday Karaoke API",
    description="Backend for the private school karaoke queue application.",
    version=__version__,
)


def _service_info(status: str) -> ServiceInfo:
    return ServiceInfo(service=SERVICE_NAME, status=status, version=__version__)


@app.get("/", response_model=ServiceInfo)
def root() -> ServiceInfo:
    """Service identity endpoint, used to verify the API is running."""
    return _service_info(status="ok")


@app.get("/health", response_model=ServiceInfo)
def health() -> ServiceInfo:
    """Liveness check used by local tooling and, later, Docker health checks."""
    return _service_info(status="ok")
