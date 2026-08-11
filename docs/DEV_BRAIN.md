# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M9 — Host Dashboard** — COMPLETE (verified). The host's single control screen
for the projector.

## Current task

None (milestone finished). Next milestone: **M10 — Realtime updates**
(FastAPI WebSockets; queue/participant/host push with resync).

## M9 scope (plan.md §M9)

- Host auth screens (login/register, M3) and host identity persistence.
- Host home: create session + list own sessions (new `GET /api/v1/sessions`).
- Host dashboard for one session: current singer, current song, playback status,
  full queue (participant names, song titles, durations), QR + join code.
- Host actions backed by existing M4/M7 endpoints: start session, remove entry,
  edit entry URL, end session.
- Skip/finish/pause/resume rendered disabled (D40) — they need the M11 playback
  state machine, which is not part of M9.

## Verification results (M9 acceptance criteria, plan.md §M9)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Host dashboard usable on a projector/TV | Verified — projector/TV CSS (large text, high contrast, minimal scrolling for current/next; two-column layout collapsing under 60rem) + `npm run typecheck` (0 errors), `npm run build` (ok), `npm run lint` (0 issues) |
| One screen to control karaoke | Verified via live smoke through the Vite dev proxy against PostgreSQL: `/host/login`, `/host`, `/host/sessions/:id`, `/join*` all serve 200; register → login → create session → list sessions → QR (200 `image/svg+xml`) → public snapshot → start (ACTIVE) → end (ENDED) all propagate through `localhost:5173/api`. Host remove/edit use the existing M7 endpoints (404 on missing entries; 503 only when the YouTube API key is unset — pre-existing M7 behavior). |

Extra verification performed:

- Routing: `/host/login` (auth), `/host` (home), `/host/sessions/:sessionId`
  (dashboard), unknown -> redirect. Participant routes unchanged.
- Host identity persistence (D39): login stores token/email/hostId in
  localStorage; refresh resumes the home screen (E11); logout revokes + clears.
- Dashboard renders only backend state: now/next derived from entry `status`
  values (SINGING/NEXT/WAITING — M11 assigns real statuses), session status
  from the authoritative session + snapshot.
- Backend suite: **163 passed** (+5 for the new list endpoint), pyright 0/0.

## Files changed (M9)

```text
backend/app/services/session.py              (+ SessionService.list_for_host, M9)
backend/app/api/routes/sessions.py           (+ GET /api/v1/sessions list endpoint)
backend/tests/test_sessions.py               (+ 5 tests: list endpoint)
frontend/src/api/types.ts                    (+ HostProfile, HostLoginResult, Session)
frontend/src/api/client.ts                   (+ apiRequestText for SVG QR)
frontend/src/api/host.ts                     (new — host auth + session APIs + QR)
frontend/src/api/entries.ts                  (+ removeEntry, editEntryVideo)
frontend/src/lib/hostToken.ts                (new — host identity in localStorage, D39)
frontend/src/lib/session.ts                  (new — shared statusLabel helper)
frontend/src/features/host/HostAuthScreen.tsx (new — login/register)
frontend/src/features/host/HostHomeScreen.tsx (new — create + list sessions)
frontend/src/features/host/HostDashboardScreen.tsx (new — the dashboard)
frontend/src/features/queue/QueueScreen.tsx  (use shared statusLabel)
frontend/src/App.tsx                         (+ /host routes, host link on landing)
frontend/src/App.css                         (+ host dashboard projector/TV styles)
docs/DECISIONS.md                            (D39 host identity + session list; D40 playback actions disabled)
docs/API_CONTRACT.md                         (GET /api/v1/sessions documented)
docs/ARCHITECTURE.md                         (frontend structure, backend API, rules)
docs/PROJECT_BRAIN.md                        (milestones, limitations, decisions)
docs/DEV_BRAIN.md                            (updated, this file)
docs/RUNBOOK.md                              (M9 checklist)
```

## Implementation notes (M9)

- **Backend stays authoritative (D2):** the dashboard renders the session + queue
  snapshot exactly as the backend returns them; the only client persistence is
  the host identity in localStorage (D39). Positions, statuses, and session state
  all come from the API.
- **One small backend addition:** `GET /api/v1/sessions` (owning host, newest
  first) — required for the dashboard home and E11 re-sync. Naming follows D30
  (`list_sessions`, never like a dependency).
- **QR display:** `apiRequestText` fetches the SVG QR (D32) with the host bearer
  token and renders it as a data URL — the `/qr` endpoint requires host auth, so
  a plain `<img src>` could not be used.
- **Playback actions disabled (D40):** skip/finish/pause/resume are rendered with
  a "Arrives with playback (M11)" tooltip and call no endpoint; start/remove/
  edit/end are fully wired.
- **Polling (D38):** the dashboard polls the public snapshot every 5 s (5 s is a
  placeholder for the M10 WebSocket channel). The session (host) fetch + QR fetch
  happen once on load.
- **Edit flow (E7):** inline URL editor per entry; on save it calls the M7
  `PATCH /entries/{id}/video`; a rejected replacement shows the backend error and
  keeps the old URL (the backend never replaced it).
- **No test framework added:** the plan's testing choice is backend pytest; the
  frontend quality gates remain `npm run typecheck` / `build` / `lint` plus the
  e2e smoke above.

## Tests added (M9)

- Backend: 5 tests for `GET /api/v1/sessions` (auth required, empty list, only
  own sessions, `(created_at, id)` desc ordering, includes status/join_code).
  Frontend: none (see above). Backend suite total: **163 passed**.

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

**M10 — Realtime updates** (backend + frontend): FastAPI WebSockets push typed
domain events (QueueUpdated, SingerStarted, …, see plan.md §M10) to participant
and host streams; clients resync from the REST API after reconnect (D5). Until
then both the participant queue screen and the host dashboard poll every 5 s.
