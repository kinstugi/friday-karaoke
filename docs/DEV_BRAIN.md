# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M8 — Participant Queue UI** — COMPLETE (verified). First frontend milestone.

## Current task

None (milestone finished). Next milestone: **M9 — Host Dashboard** (frontend).

## M8 scope (plan.md §M8)

- Mobile-first participant queue experience (no host dashboard yet).
- Screens: join (lookup + nickname), song submit (preview -> confirm), queue
  (status, positions, own entries, cancel).
- Participant actions: join, cancel own WAITING entry, view position, view queue.

## Verification results (M8 acceptance criteria, plan.md §M8)

| Acceptance criterion | Result |
| -------------------- | ------ |
| A student can use the entire queue flow from a phone | Verified — `npm run typecheck` (0 errors), `npm run build` (ok), `npm run lint` (0 issues), plus an end-to-end smoke through the Vite dev proxy against a live backend on SQLite: SPA route `/join/{code}` serves 200; register/login/create session; public lookup by join code; participant join; empty queue snapshot; preview error path (503 without API key) all propagate correctly through `localhost:5173/api`. |

Extra verification performed:

- Routing: `/join/:code` (join), `/join/:code/queue` (queue), `/join/:code/submit`
  (submit), `/join` landing, unknown -> redirect.
- Identity persistence (D38): joining stores the token/session in localStorage;
  refresh resumes the queue (E8).
- Queue screen renders the backend-provided statuses only: "Now singing" shows the
  SINGING entry; "Up next" shows the backend's NEXT entry, or the first non-singing
  queued entry while playback is not yet running (M11 assigns real statuses); own
  WAITING entries get a Cancel button.
- Backend suite unchanged: **158 passed**, pyright 0/0 (no backend code touched).

## Files changed (M8)

```text
frontend/package.json / package-lock.json   (+ react-router-dom)
frontend/vite.config.ts                     (dev proxy: /api -> http://localhost:8000)
frontend/src/api/types.ts                   (new — TS types mirroring backend schemas)
frontend/src/api/client.ts                  (new — typed fetch wrapper + ApiError)
frontend/src/api/session.ts                 (new — join lookup + register)
frontend/src/api/entries.ts                 (new — preview, submit, snapshot, cancel)
frontend/src/lib/token.ts                   (new — participant identity in localStorage, D38)
frontend/src/lib/format.ts                  (new — duration formatting)
frontend/src/features/join/JoinScreen.tsx   (new — session lookup + nickname join)
frontend/src/features/submit/SubmitSongScreen.tsx (new — URL -> preview -> add)
frontend/src/features/queue/QueueScreen.tsx (new — polled snapshot, positions, cancel)
frontend/src/App.tsx                        (router: join/queue/submit routes)
frontend/src/index.css / App.css            (mobile-first styles, >=44px touch targets)
docs/DECISIONS.md                           (D38 participant identity + polling)
docs/ARCHITECTURE.md                        (§4 frontend structure now implemented)
docs/PROJECT_BRAIN.md                       (milestones, limitations)
docs/DEV_BRAIN.md                           (updated, this file)
docs/RUNBOOK.md                             (M8 checklist)
```

## Implementation notes (M8)

- **Frontend never owns state (D2):** every screen renders backend responses; the
  only client-side persistence is the participant *identity* (token/session) in
  localStorage (D38). No queue state is stored or merged client-side.
- **Typed API client:** `src/api/` wraps `fetch` with `apiRequest<T>` (JSON,
  bearer header, 204 handling, `ApiError` carrying the backend `detail` message);
  `types.ts` mirrors the backend Pydantic contracts so the UI compiles against
  the real shapes.
- **Routing:** `react-router-dom` BrowserRouter; the join URL produced by the
  backend (`{public_base_url}/join/{code}`) maps to `/join/:code`. After joining,
  identity is saved and the app redirects to `/join/:code/queue`.
- **Polling (D38):** QueueScreen polls `GET /api/v1/sessions/{id}/entries` every
  5 s (5 s is a placeholder for the M10 WebSocket channel). Now/next cards are
  derived purely from the entry `status` values the backend returns.
- **Vite proxy:** dev server proxies `/api` to `http://localhost:8000`, so the
  SPA uses same-origin paths (no CORS config needed in dev; M20 reverse proxy
  does the same in production).
- **No test framework added:** the plan's testing choice is backend pytest; the
  frontend quality gates remain `npm run typecheck` / `build` / `lint` plus the
  e2e smoke above. Adding vitest is not in scope.

## Tests added (M8)

- None (frontend). Backend suite unchanged: **158 passed**.

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

**M9 — Host Dashboard** (frontend): the host's single control screen for the
projector — current singer/song/playback status, full queue (names, titles,
durations), and actions (start, skip, remove, edit, pause/resume, end session),
using the host endpoints from M4/M7. See `plan.md` §M9 and `docs/PRODUCT_SPEC.md`
§5.3-5.7 / §7.4.
