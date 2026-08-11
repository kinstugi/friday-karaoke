"""Tests for the queue engine (M7).

Covers submission (active-entry limit B15, duplicate notice B16, deterministic
ordering E19), the public snapshot with computed positions (D8), participant
cancellation (B3), host removal and URL editing (B4/E7), and persistence.
The YouTube fetch is mocked; parsing is covered in test_youtube.py.
"""

import uuid

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.queue_entry import QueueEntryStatus
from app.models.queue_entry import QueueEntry
from app.models.youtube_video import YouTubeVideo
from app.schemas.youtube import YouTubeVideoData
from app.services.youtube import (
    YouTubeVideoUnavailableError,
    youtube_service,
)

SESSIONS_URL = "/api/v1/sessions"
JOIN_URL = "/api/v1/join"
ENTRIES_URL = "/api/v1/entries"
REGISTER_URL = "/api/v1/auth/host/register"
LOGIN_URL = "/api/v1/auth/host/login"

EMAIL = "host@example.com"
OTHER_EMAIL = "other@example.com"
PASSWORD = "correct-horse-battery-staple"

VIDEO_A_ID = "dQw4w9WgXcQ"
VIDEO_B_ID = "9bZkp7q19f0"


def _sample_metadata(
    video_id: str, title: str, channel: str, duration_seconds: int = 213
) -> YouTubeVideoData:
    return YouTubeVideoData(
        video_id=video_id,
        youtube_url=f"https://www.youtube.com/watch?v={video_id}",
        title=title,
        channel=channel,
        duration_seconds=duration_seconds,
        thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/medium.jpg",
    )


def _patch_youtube(
    monkeypatch: pytest.MonkeyPatch, videos: dict[str, YouTubeVideoData]
) -> None:
    async def fake_fetch(video_id: str) -> YouTubeVideoData:
        if video_id not in videos:
            raise YouTubeVideoUnavailableError(video_id)
        return videos[video_id]

    monkeypatch.setattr(youtube_service, "fetch_video_metadata", fake_fetch)


def _register_host(client: TestClient, email: str = EMAIL) -> dict[str, str]:
    register = client.post(REGISTER_URL, json={"email": email, "password": PASSWORD})
    assert register.status_code == 201, register.text
    login = client.post(LOGIN_URL, json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['token']}"}


def _create_session(client: TestClient, headers: dict[str, str]) -> dict:
    created = client.post(SESSIONS_URL, json={}, headers=headers)
    assert created.status_code == 201, created.text
    return created.json()


def _join_participant(
    client: TestClient, session_body: dict, nickname: str = "Alice"
) -> str:
    joined = client.post(
        f"{JOIN_URL}/{session_body['join_code']}/participants",
        json={"nickname": nickname},
    )
    assert joined.status_code == 201, joined.text
    return joined.json()["token"]


def _setup(
    client: TestClient, nickname: str = "Alice", email: str = EMAIL
) -> tuple[dict[str, str], dict, str]:
    """Return (host_headers, session_body, participant_token)."""
    headers = _register_host(client, email=email)
    session_body = _create_session(client, headers)
    token = _join_participant(client, session_body, nickname=nickname)
    return headers, session_body, token


def _submit(
    client: TestClient, session_id: str, token: str, youtube_url: str
) -> httpx.Response:
    return client.post(
        f"{SESSIONS_URL}/{session_id}/entries",
        json={"youtube_url": youtube_url},
        headers={"Authorization": f"Bearer {token}"},
    )


def _snapshot(client: TestClient, session_id: str) -> httpx.Response:
    return client.get(f"{SESSIONS_URL}/{session_id}/entries")


def _video_a() -> YouTubeVideoData:
    return _sample_metadata(VIDEO_A_ID, "Song A", "Artist A")


def _video_b() -> YouTubeVideoData:
    return _sample_metadata(VIDEO_B_ID, "Song B", "Artist B")


# --- Submit ---------------------------------------------------------------------


def test_submit_requires_participant_authentication(client: TestClient) -> None:
    response = client.post(
        f"{SESSIONS_URL}/{uuid.uuid4()}/entries",
        json={"youtube_url": f"https://youtu.be/{VIDEO_A_ID}"},
    )
    assert response.status_code == 401


def test_submit_creates_waiting_entry(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, token = _setup(client)

    response = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["duplicate"] is False
    assert body["notice"] is None
    entry = body["entry"]
    assert entry["status"] == QueueEntryStatus.WAITING.value
    assert entry["participant_name"] == "Alice"
    assert entry["video_id"] == VIDEO_A_ID
    assert entry["title"] == "Song A"
    assert entry["channel"] == "Artist A"
    assert entry["duration_seconds"] == 213
    assert entry["position"] == 1
    assert entry["youtube_url"] == f"https://www.youtube.com/watch?v={VIDEO_A_ID}"


def test_submit_cross_session_participant_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_a, token_a = _setup(client, email=EMAIL)
    _, session_b, _ = _setup(client, email=OTHER_EMAIL)

    response = _submit(client, session_b["id"], token_a, f"https://youtu.be/{VIDEO_A_ID}")
    assert response.status_code == 404
    assert session_a["id"] != session_b["id"]


def test_submit_ended_session_conflicts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    headers, session_body, token = _setup(client)
    client.post(f"{SESSIONS_URL}/{session_body['id']}/end", headers=headers)

    response = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert response.status_code == 409
    assert "ended" in response.json()["detail"]


def test_submit_invalid_url_is_unprocessable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, token = _setup(client)
    response = _submit(client, session_body["id"], token, "not-a-url")
    assert response.status_code == 422


def test_submit_unavailable_video_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {})
    _, session_body, token = _setup(client)
    response = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert response.status_code == 404
    assert "couldn't load" in response.json()["detail"]


def test_submit_active_entry_limit_conflicts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    _, session_body, token = _setup(client)
    first = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert first.status_code == 201
    second = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_B_ID}")
    assert second.status_code == 201
    assert second.json()["entry"]["position"] == 2

    third = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert third.status_code == 409
    assert "active songs" in third.json()["detail"]


def test_submit_duplicate_song_notice_not_a_block(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, alice = _setup(client, nickname="Alice")
    bob = _join_participant(client, session_body, nickname="Bob")

    first = _submit(client, session_body["id"], alice, f"https://youtu.be/{VIDEO_A_ID}")
    assert first.status_code == 201
    assert first.json()["duplicate"] is False

    second = _submit(client, session_body["id"], bob, f"https://youtu.be/{VIDEO_A_ID}")
    assert second.status_code == 201  # allowed, not blocked (B16)
    body = second.json()
    assert body["duplicate"] is True
    assert body["notice"] is not None
    assert "already in the queue" in body["notice"]


def test_submit_after_cancel_frees_a_limit_slot(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    _, session_body, token = _setup(client)
    first = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    second = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_B_ID}")
    first_entry_id = first.json()["entry"]["id"]

    cancel = client.delete(
        f"{ENTRIES_URL}/{first_entry_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cancel.status_code == 204

    third = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    assert third.status_code == 201  # cancelled entries do not count (B15)


# --- Snapshot -------------------------------------------------------------------


def test_snapshot_requires_no_authentication(client: TestClient) -> None:
    _, session_body, _ = _setup(client)
    response = _snapshot(client, session_body["id"])
    assert response.status_code == 200


def test_snapshot_returns_deterministic_order_and_positions(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    _, session_body, alice = _setup(client, nickname="Alice")
    bob = _join_participant(client, session_body, nickname="Bob")
    _submit(client, session_body["id"], alice, f"https://youtu.be/{VIDEO_A_ID}")
    _submit(client, session_body["id"], bob, f"https://youtu.be/{VIDEO_B_ID}")

    response = _snapshot(client, session_body["id"])
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_body["id"]
    assert body["status"] == "CREATED"
    queue = body["queue"]
    assert [e["participant_name"] for e in queue] == ["Alice", "Bob"]
    assert [e["position"] for e in queue] == [1, 2]
    assert [e["video_id"] for e in queue] == [VIDEO_A_ID, VIDEO_B_ID]


def test_snapshot_excludes_processed_entries(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    client.delete(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    body = _snapshot(client, session_body["id"]).json()
    assert body["queue"] == []


def test_snapshot_unknown_session_is_not_found(client: TestClient) -> None:
    response = _snapshot(client, str(uuid.uuid4()))
    assert response.status_code == 404


# --- Cancel (participant) --------------------------------------------------------


def test_cancel_requires_authentication(client: TestClient) -> None:
    response = client.delete(f"{ENTRIES_URL}/{uuid.uuid4()}")
    assert response.status_code == 401


def test_cancel_own_waiting_entry(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    entry_id = submitted.json()["entry"]["id"]

    response = client.delete(
        f"{ENTRIES_URL}/{entry_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204


def test_cancel_other_participants_entry_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, alice = _setup(client, nickname="Alice")
    bob = _join_participant(client, session_body, nickname="Bob")
    submitted = _submit(client, session_body["id"], alice, f"https://youtu.be/{VIDEO_A_ID}")

    response = client.delete(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}",
        headers={"Authorization": f"Bearer {bob}"},
    )
    assert response.status_code == 404


def test_cancel_entry_from_another_session_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_a, token_a = _setup(client, email=EMAIL)
    _, session_b, token_b = _setup(client, email=OTHER_EMAIL)
    submitted = _submit(client, session_a["id"], token_a, f"https://youtu.be/{VIDEO_A_ID}")

    response = client.delete(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 404


def test_cancel_non_waiting_entry_conflicts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    headers, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    entry_id = submitted.json()["entry"]["id"]
    # Host removes it first (status -> REMOVED); participant cancel must 409.
    client.delete(f"{ENTRIES_URL}/{entry_id}", headers=headers)

    response = client.delete(
        f"{ENTRIES_URL}/{entry_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409
    assert "WAITING" in response.json()["detail"]


def test_cancel_unknown_entry_is_not_found(client: TestClient) -> None:
    _, _, token = _setup(client)
    response = client.delete(
        f"{ENTRIES_URL}/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


# --- Remove (host) ----------------------------------------------------------------


def test_remove_any_entry_by_host(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    headers, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")

    response = client.delete(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}", headers=headers
    )
    assert response.status_code == 204
    assert _snapshot(client, session_body["id"]).json()["queue"] == []


def test_remove_by_non_owner_host_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    headers_a, session_body, token = _setup(client, email=EMAIL)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    headers_b = _register_host(client, email=OTHER_EMAIL)

    response = client.delete(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}", headers=headers_b
    )
    assert response.status_code == 404


def test_remove_unknown_entry_is_not_found(client: TestClient) -> None:
    headers = _register_host(client)
    response = client.delete(f"{ENTRIES_URL}/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 404


# --- Edit (host) -------------------------------------------------------------------


def test_edit_requires_host_authentication(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    entry_id = submitted.json()["entry"]["id"]

    # Missing token -> 401; participant token is also rejected (host-only).
    no_auth = client.patch(
        f"{ENTRIES_URL}/{entry_id}/video", json={"youtube_url": f"https://youtu.be/{VIDEO_B_ID}"}
    )
    assert no_auth.status_code == 401
    with_token = client.patch(
        f"{ENTRIES_URL}/{entry_id}/video",
        json={"youtube_url": f"https://youtu.be/{VIDEO_B_ID}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert with_token.status_code == 401


def test_edit_video_keeps_position_and_participant(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    headers, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    entry_id = submitted.json()["entry"]["id"]

    response = client.patch(
        f"{ENTRIES_URL}/{entry_id}/video",
        json={"youtube_url": f"https://youtu.be/{VIDEO_B_ID}"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["video_id"] == VIDEO_B_ID
    assert body["title"] == "Song B"
    assert body["participant_name"] == "Alice"
    assert body["position"] == 1


def test_edit_video_by_non_owner_host_is_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    headers_a, session_body, token = _setup(client, email=EMAIL)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")
    headers_b = _register_host(client, email=OTHER_EMAIL)

    response = client.patch(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}/video",
        json={"youtube_url": f"https://youtu.be/{VIDEO_B_ID}"},
        headers=headers_b,
    )
    assert response.status_code == 404


def test_edit_video_invalid_url_is_unprocessable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_youtube(
        monkeypatch,
        {VIDEO_A_ID: _video_a(), VIDEO_B_ID: _video_b()},
    )
    headers, session_body, token = _setup(client)
    submitted = _submit(client, session_body["id"], token, f"https://youtu.be/{VIDEO_A_ID}")

    response = client.patch(
        f"{ENTRIES_URL}/{submitted.json()['entry']['id']}/video",
        json={"youtube_url": "not-a-url"},
        headers=headers,
    )
    assert response.status_code == 422
    # Old video is kept (E7).
    snapshot = _snapshot(client, session_body["id"]).json()
    assert snapshot["queue"][0]["video_id"] == VIDEO_A_ID


# --- Persistence --------------------------------------------------------------------


async def test_submit_persists_entry_and_shared_video_row(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, session: AsyncSession
) -> None:
    _patch_youtube(monkeypatch, {VIDEO_A_ID: _video_a()})
    _, session_body, alice = _setup(client, nickname="Alice")
    bob = _join_participant(client, session_body, nickname="Bob")
    _submit(client, session_body["id"], alice, f"https://youtu.be/{VIDEO_A_ID}")
    _submit(client, session_body["id"], bob, f"https://youtu.be/{VIDEO_A_ID}")

    entry_count = await session.scalar(select(func.count(QueueEntry.id)))
    assert entry_count == 2
    video_count = await session.scalar(select(func.count(YouTubeVideo.id)))
    assert video_count == 1  # duplicate songs share the metadata row (B16)
    video = await session.scalar(select(YouTubeVideo))
    assert video is not None
    assert video.youtube_video_id == VIDEO_A_ID
    assert video.title == "Song A"
    assert video.duration_seconds == 213
