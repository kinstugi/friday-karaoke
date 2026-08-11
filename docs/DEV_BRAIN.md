# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M6 — YouTube URL Submission + Metadata** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M7 — Queue Management**.

## M6 scope (plan.md §M6)

- Validate a YouTube URL (watch + youtu.be) and extract the video ID.
- Fetch metadata (title, channel, duration, thumbnail).
- Return a preview with a warning for unusually long videos (never reject).

## Verification results (M6 acceptance criteria, plan.md §M6)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Participant pastes a valid YouTube URL and sees a preview before joining | Verified — `POST /api/v1/sessions/{id}/entries/preview` (participant token) returns canonical URL, video id, title, channel, duration, thumbnail plus `is_long`/`warning` (`test_preview_returns_metadata`, `test_preview_long_video_warns_but_is_not_rejected`). Long videos warn but are never rejected (B6/D34). |

Extra verification performed:

- URL validation: watch (`youtube.com`, `m.`, `music.`), youtu.be, embed, shorts
  all extract the 11-char ID; 15 invalid cases rejected (parametrized
  `test_extract_video_id_*`).
- Metadata source is the YouTube Data API v3 (D33); the fetch is tested with an
  `httpx.MockTransport` (no network): parsing, empty items → unavailable, HTTP
  error → unavailable, missing title → unavailable, missing API key →
  configuration error (`tests/test_youtube.py`).
- Endpoint guards: 401 without/with invalid participant token, 404 for another
  session's participant or unknown session, 409 for ended sessions, 422 for
  malformed URLs (E3), 404 for unavailable videos (E4), 503 when the API key is
  unset.
- `uv run pytest`: 129 passed (46 new: 37 unit + 9 endpoint). `uv run pyright`:
  0 errors, 0 warnings.
- Health, host auth, sessions, join endpoints unchanged and still green.

## Files changed (M6)

```text
backend/pyproject.toml                (httpx moved to runtime deps)
backend/uv.lock                       (updated)
backend/app/core/config.py            (+ youtube_api_key, youtube_long_video_seconds)
backend/.env.example                  (+ KARAOKE_YOUTUBE_API_KEY, KARAOKE_YOUTUBE_LONG_VIDEO_SECONDS)
backend/app/schemas/youtube.py        (new — SongPreviewRequest/Response, YouTubeVideoData)
backend/app/services/youtube.py       (new — extract_video_id, duration parsing, Data API fetch)
backend/app/services/participant.py   (+ get_by_token)
backend/app/services/session.py       (+ get_by_id)
backend/app/api/dependencies.py       (+ get_current_participant)
backend/app/api/routes/entries.py     (new — POST .../entries/preview)
backend/app/main.py                   (include entries router)
backend/tests/test_youtube.py         (new — 30 unit tests)
backend/tests/test_entries.py         (new — 14 endpoint tests)
backend/tests/test_config.py          (pin new settings defaults)
docs/API_CONTRACT.md                  (§5 preview implemented)
docs/DECISIONS.md                     (D33 Data API v3, D34 long-video threshold; open Q resolved)
docs/ARCHITECTURE.md                  (§3 implementation status, §7 phases)
docs/PROJECT_BRAIN.md                 (milestones, limitations, decisions)
docs/DEV_BRAIN.md                     (updated, this file)
docs/RUNBOOK.md                       (M6 checklist + preview smoke test)
```

## Implementation notes (M6)

- **Metadata source (D33):** YouTube Data API v3
  (`videos?part=snippet,contentDetails`). The oEmbed endpoint was rejected
  because it has no duration field. `KARAOKE_YOUTUBE_API_KEY` is required for
  real use; unset → 503. The `fetch_video_metadata` method accepts an optional
  `httpx.AsyncClient` so tests inject a `MockTransport` (no key, no network).
- **URL validation:** `extract_video_id` supports `watch?v=`, youtu.be, embed,
  and shorts; rejects non-http(s) schemes, non-YouTube hosts, missing/malformed
  IDs. Returns the canonical watch URL in the response.
- **Duration:** `parse_iso_duration` converts `PT#H#M#S` to seconds;
  `format_duration` renders `m:ss`/`h:mm:ss` for the warning text.
- **Long-video warning (D34):** `is_long = duration_seconds >
  KARAOKE_YOUTUBE_LONG_VIDEO_SECONDS` (default 600 s); the warning is advisory
  only — the preview always returns 200 for fetchable videos.
- **Participant auth:** new `get_current_participant` dependency resolves the
  participant from the M5 opaque token; endpoints additionally enforce the
  participant's session binding (mismatch → 404, no existence leak) and the
  ended-session guard (409).
- **Preview is stateless:** nothing is persisted until the queue entry lands in
  M7 (no `YouTubeVideo` table yet). The response shape matches the fields M7
  will store.
- **FastAPI D30 rule respected:** the new endpoint is named `preview_song`; no
  `__name__` collision with the `get_session`/`get_current_participant`
  dependencies.

## Tests added (M6)

- `tests/test_youtube.py` — 37 unit tests: 10 supported URL shapes + 12 invalid
  shapes for `extract_video_id` (parametrized), `parse_iso_duration` (7 cases),
  `format_duration`, and 7 Data API fetch tests via `httpx.MockTransport`
  (success parsing, missing key, empty items, HTTP error, missing title,
  transport error, non-JSON body).
- `tests/test_entries.py` — 9 endpoint tests: auth required, cross-session
  404, unknown session 404, ended session 409, invalid URL 422, metadata 200,
  long-video warning, unavailable video 404, unconfigured service 503.
- **129 passed** total (was 85 at M5).

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): realtime payload schemas
  (M10), Web Push (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.

## Next recommended task

**M7 — Queue Management** — the authoritative queue engine: `QueueEntry` +
`YouTubeVideo` tables, `POST /sessions/{id}/entries` (submit, with the M6
preview data), public queue snapshot with computed positions (D8, no mutable
position field), participant cancel of own WAITING entry, host remove/edit.
See `plan.md` §M7 and `docs/PRODUCT_SPEC.md` §6.5-6.6 / §9 B3-B7, D15-D17.
