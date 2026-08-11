"""Tests for karaoke session creation and lifecycle (M4).

Covers create/get/start/end endpoints, host ownership, join-code generation,
and the ``SessionStatus`` state machine.
"""

import uuid
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.domain.session import SessionStatus
from app.models.host import Host
from app.models.session import Session

SESSIONS_URL = "/api/v1/sessions"
LOGIN_URL = "/api/v1/auth/host/login"
REGISTER_URL = "/api/v1/auth/host/register"

EMAIL = "host@example.com"
OTHER_EMAIL = "other@example.com"
PASSWORD = "correct-horse-battery-staple"

#: Join-code alphabet must match app/services/session.py.
_JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _register(client: TestClient, email: str = EMAIL) -> None:
    response = client.post(REGISTER_URL, json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text


def _auth_headers(client: TestClient, email: str = EMAIL) -> dict[str, str]:
    _register(client, email=email)
    response = client.post(LOGIN_URL, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _create_session(
    client: TestClient, headers: dict[str, str], name: str | None = None
) -> dict:
    payload = {"name": name} if name is not None else {}
    response = client.post(SESSIONS_URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# --- SessionStatus state machine (unit) -----------------------------------


def test_created_can_start_and_end() -> None:
    assert SessionStatus.CREATED.can_transition_to(SessionStatus.ACTIVE)
    assert SessionStatus.CREATED.can_transition_to(SessionStatus.ENDED)


def test_created_cannot_skip_to_paused_or_round_complete() -> None:
    assert not SessionStatus.CREATED.can_transition_to(SessionStatus.PAUSED)
    assert not SessionStatus.CREATED.can_transition_to(SessionStatus.ROUND_COMPLETE)


def test_ended_is_terminal() -> None:
    statuses = set(SessionStatus)
    for status in statuses:
        assert not SessionStatus.ENDED.can_transition_to(status)


def test_end_allowed_from_every_non_terminal_state() -> None:
    for status in SessionStatus:
        if status is not SessionStatus.ENDED:
            assert status.can_transition_to(SessionStatus.ENDED), status


def test_start_only_allowed_from_created_and_active_neighbors() -> None:
    # In M4 only CREATED -> ACTIVE is reachable (start), but the documented
    # lifecycle also allows PAUSED -> ACTIVE (resume, M14) and
    # ROUND_COMPLETE -> ACTIVE (start next round, M16).
    expected = {
        SessionStatus.CREATED: True,
        SessionStatus.ACTIVE: False,
        SessionStatus.PAUSED: True,
        SessionStatus.ROUND_COMPLETE: True,
        SessionStatus.ENDED: False,
    }
    for status, allowed in expected.items():
        assert status.can_transition_to(SessionStatus.ACTIVE) is allowed, status


# --- Create session ---------------------------------------------------------


def test_create_session_requires_authentication(client: TestClient) -> None:
    response = client.post(SESSIONS_URL, json={})
    assert response.status_code == 401


def test_create_session_returns_session(client: TestClient) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers)

    assert uuid.UUID(body["id"])
    assert body["name"].startswith("Friday Karaoke - ")
    assert len(body["join_code"]) == 6
    assert all(c in _JOIN_CODE_ALPHABET for c in body["join_code"])
    assert body["status"] == SessionStatus.CREATED.value
    assert "created_at" in body
    assert body["started_at"] is None
    assert body["ended_at"] is None


def test_create_session_defaults_name(client: TestClient) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers)
    expected = f"Friday Karaoke - {datetime.now().date().isoformat()}"
    assert body["name"] == expected


def test_create_session_blank_name_defaults(client: TestClient) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers, name="   ")
    expected = f"Friday Karaoke - {datetime.now().date().isoformat()}"
    assert body["name"] == expected


def test_create_session_uses_custom_name(client: TestClient) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers, name="  Spring Concert Night  ")
    assert body["name"] == "Spring Concert Night"


def test_create_session_rejects_overlong_name(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.post(
        SESSIONS_URL, json={"name": "x" * 101}, headers=headers
    )
    assert response.status_code == 422


async def test_create_session_persists_owner(client: TestClient, session: AsyncSession) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers)

    stored = await session.scalar(select(Session).where(Session.id == uuid.UUID(body["id"])))
    assert stored is not None
    host = await session.scalar(select(Host).where(Host.email == EMAIL))
    assert host is not None
    assert stored.host_id == host.id


def test_join_codes_are_unique(client: TestClient) -> None:
    headers = _auth_headers(client)
    first = _create_session(client, headers)
    second = _create_session(client, headers)
    assert first["join_code"] != second["join_code"]


def test_join_url_is_derived_from_base_url(client: TestClient) -> None:
    headers = _auth_headers(client)
    body = _create_session(client, headers)
    base_url = get_settings().public_base_url
    assert body["join_url"] == f"{base_url}/join/{body['join_code']}"


# --- Get session -------------------------------------------------------------


def test_get_session_requires_authentication(client: TestClient) -> None:
    response = client.get(f"{SESSIONS_URL}/{uuid.uuid4()}")
    assert response.status_code == 401


def test_get_session_returns_owned_session(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)

    response = client.get(f"{SESSIONS_URL}/{created['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]
    assert response.json()["status"] == SessionStatus.CREATED.value


def test_get_session_another_host_is_not_found(client: TestClient) -> None:
    headers_a = _auth_headers(client, email=EMAIL)
    created = _create_session(client, headers_a)
    headers_b = _auth_headers(client, email=OTHER_EMAIL)

    response = client.get(f"{SESSIONS_URL}/{created['id']}", headers=headers_b)
    assert response.status_code == 404


def test_get_session_missing_is_not_found(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get(f"{SESSIONS_URL}/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 404


def test_get_session_invalid_uuid_is_unprocessable(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get(f"{SESSIONS_URL}/not-a-uuid", headers=headers)
    assert response.status_code == 422


# --- Start session ------------------------------------------------------------


def test_start_session_requires_authentication(client: TestClient) -> None:
    response = client.post(f"{SESSIONS_URL}/{uuid.uuid4()}/start")
    assert response.status_code == 401


def test_start_session_transitions_to_active(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == SessionStatus.ACTIVE.value
    assert body["started_at"] is not None
    assert body["ended_at"] is None


def test_start_session_another_host_is_not_found(client: TestClient) -> None:
    headers_a = _auth_headers(client, email=EMAIL)
    created = _create_session(client, headers_a)
    headers_b = _auth_headers(client, email=OTHER_EMAIL)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers_b)
    assert response.status_code == 404


def test_start_session_already_active_conflicts(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)
    client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers)
    assert response.status_code == 409


def test_start_session_after_end_conflicts(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)
    client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers)
    assert response.status_code == 409


# --- End session ---------------------------------------------------------------


def test_end_session_requires_authentication(client: TestClient) -> None:
    response = client.post(f"{SESSIONS_URL}/{uuid.uuid4()}/end")
    assert response.status_code == 401


def test_end_active_session(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)
    client.post(f"{SESSIONS_URL}/{created['id']}/start", headers=headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == SessionStatus.ENDED.value
    assert body["started_at"] is not None
    assert body["ended_at"] is not None


def test_end_created_session(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == SessionStatus.ENDED.value


def test_end_session_another_host_is_not_found(client: TestClient) -> None:
    headers_a = _auth_headers(client, email=EMAIL)
    created = _create_session(client, headers_a)
    headers_b = _auth_headers(client, email=OTHER_EMAIL)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers_b)
    assert response.status_code == 404


def test_end_session_already_ended_conflicts(client: TestClient) -> None:
    headers = _auth_headers(client)
    created = _create_session(client, headers)
    client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers)

    response = client.post(f"{SESSIONS_URL}/{created['id']}/end", headers=headers)
    assert response.status_code == 409
