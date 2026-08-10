"""Tests for the minimal M0 backend application."""

from fastapi.testclient import TestClient

from app.main import SERVICE_NAME, app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "service": SERVICE_NAME,
        "status": "ok",
        "version": "0.1.0",
    }


def test_root_returns_service_identity() -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == SERVICE_NAME
    assert body["status"] == "ok"
