# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M17 — Security + abuse protection** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M18 — Testing + failure scenarios**
(behavioral tests: queue ordering, state/round transitions, skip/finish/remove/
cancel, next-round enrollment → round auto-advance; integration + concurrency
tests, e.g. two users join simultaneously, host skips during a transition,
participant cancels while host removes, host/participant reconnect recovery).

## M17 scope (plan.md §M17)

Make the application safe enough for real school use, focusing on **realistic
threats to a public QR code**: rate limiting the join/preview/submit surface and
protecting the YouTube Data API quota. The rest of the checklist was already in
place (see DECISIONS D49).

## Verification results (M17 acceptance, plan.md §M17 — threat-focused)

| Criterion | Result |
| --------- | ------ |
| Rate limiting (public QR surface) | Verified — in-process fixed-window limiter (per-IP, `KARAOKE_RATE_LIMITS_ENABLED`): join 10/min, preview 20/min, submit 20/min → 429 beyond; live smoke: 10 joins 201 then the 11th **429**; `test_join_storm_is_rate_limited`, `test_allows_up_to_limit_then_blocks` |
| Protect YouTube Data API quota | Verified — in-process TTL metadata cache (`KARAOKE_YOUTUBE_CACHE_TTL_SECONDS`, default 1 h): the same video previewed/submitted repeatedly costs one API call; `test_fetch_metadata_caches_repeated_lookups`, `test_fetch_metadata_cache_clears`; live preview repeated → 200 from cache |
| Request validation, token hygiene, authorization, URL validation, active-entry cap | Verified — already in place (Pydantic bounds, opaque hashed tokens D25/D31, ownership 404s D29, URL validation D33/D34, cap D45); regression-covered by the existing suite |
| Session expiration/cleanup strategy | Verified — **retention strategy documented** (D49): sessions are intentionally retained; ENDED is terminal; a deletion/retention policy is an M22 ops decision (no destructive auto-cleanup in v1) |

Additional verification:

- Backend suite: **230 passed** (8 new rate-limit/cache tests written this
  milestone; the pre-existing security-helper tests are preserved), `pyright`
  0 errors.
- Frontend unchanged (M17 is backend-only); typecheck/lint/build still green.
- No schema change (no migration in M17).
- Live smoke against real PostgreSQL + real YouTube metadata: 11 rapid joins →
  the 11th 429; preview returned real metadata and repeated previews were
  served (cache).

## Files changed (M17)

```text
backend/app/core/ratelimit.py        (new — RateLimiter + RateLimitExceededError)
backend/app/core/config.py           (rate_limits_enabled, youtube_cache_ttl_seconds)
backend/.env.example                 (+ the two settings)
backend/app/api/dependencies.py      (rate_limit() dependency factory + shared limiter)
backend/app/api/routes/join.py       (register_participant rate-limited)
backend/app/api/routes/entries.py    (preview + submit rate-limited)
backend/app/services/youtube.py      (in-process TTL metadata cache + clear_cache)
backend/tests/conftest.py            (KARAOKE_RATE_LIMITS_ENABLED=false)
backend/tests/test_security.py       (new — 6 tests)
backend/tests/test_youtube.py        (+ 2 cache tests)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/API_CONTRACT.md,
docs/RUNBOOK.md, docs/DECISIONS.md (D49)
```

## Implementation notes (M17)

- **Rate limiter (D49):** a fixed-window counter keyed by `<scope>:<client-ip>`,
  in-process (D9). The `rate_limit(scope, limit, window)` dependency no-ops when
  `KARAOKE_RATE_LIMITS_ENABLED` is false (tests set it false so the suite is not
  coupled to wall-clock windows). The 429 body is "too many requests — please
  slow down". Buckets are lazily pruned as windows expire.
- **YouTube quota cache (D49):** `YouTubeService` caches metadata per video id
  with a 1 h TTL, so the same popular song previewed by many students costs one
  Data API call. `clear_cache()` exists for tests/admin. The cache is per
  service instance; the API-layer tests monkeypatch `fetch_video_metadata`
  (bypassing it), so they are unaffected.
- **Already-covered checklist:** Pydantic request/input bounds, opaque hashed
  bearer tokens, ownership 404s, YouTube URL validation, per-participant song
  cap, no-CSRF (bearer headers). Sessions are retained (documented strategy, no
  destructive cleanup).
- **No scope creep:** no new dependency (the limiter is ~30 lines), no Redis,
  no migration, no rate limiting of cheap public reads (snapshot/WS), no
  destructive session deletion.

## Tests added (M17)

- `tests/test_security.py` (5 new rate-limit tests, alongside the 7 preserved
  security-helper tests): limiter allows up to the limit then blocks; window
  resets; keys isolated; a join storm returns 429 with limits enabled
  (integration, monkeypatched fresh limiter + settings); limits disabled by
  default in tests (12 joins pass).
- `tests/test_youtube.py` (2): repeated lookups of the same video cost one API
  call (cache hit); `clear_cache()` forces a fresh fetch.

## Current blockers

- None.

## Unresolved technical questions

- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` + `RateLimiter` are in-process/per-worker (D42/D49): a
  multi-worker deployment needs a shared hub (Redis) and a shared limiter —
  tracked for M20 deployment.
- Web Push deferred to the PWA milestone (M19) — documented in DECISIONS.

## Next recommended task

**M18 — Testing + failure scenarios** (backend): behavioral and concurrency
tests per plan.md §M18 — deterministic queue ordering, playback/round state
transitions, skip/finish/remove/cancel semantics, two users joining
simultaneously, host skip during a transition, participant cancel while host
removes the same entry (E21), and host/participant reconnect recovery. Many of
these are partially covered by the existing suite; M18 formalizes the matrix and
adds the concurrency cases.
