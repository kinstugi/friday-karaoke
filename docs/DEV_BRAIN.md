# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M9.1 — Frontend UI polish** — COMPLETE (verified). Codified the frontend UI
quality bar and refactored every screen onto the design system.

## Current task

None (milestone finished). Next milestone: **M10 — Realtime updates**
(FastAPI WebSockets; queue/participant/host push with resync).

## M9.1 scope (plan.md §M9.1)

- Create the `frontend-ui` skill (`.opencode/skills/frontend-ui/SKILL.md`) and
  wire it into the coder + reviewer agents.
- Add a "Frontend UI quality bar" section and the M9.1 milestone to `plan.md`.
- Refactor all screens (host login/home/dashboard + participant join/submit/
  queue) onto the design system: tokens, component patterns, accessibility.
- Fix invalid HTML (`<a>` wrapping `<button>` on the host home).
- No backend changes; no new dependencies.

## Verification results (M9.1 acceptance criteria, plan.md §M9.1)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Design tokens defined and used (no hard-coded colors/spacing) | Verified — `:root` tokens in `src/index.css`; `App.css` rewritten to reference them only |
| Host dashboard projector/TV-ready | Verified — large text (2rem heading, 2.4rem join code), high contrast, now/next above the fold, actions grouped, disabled actions dimmed with tooltips |
| Participant screens mobile-first with ≥ 44px targets | Verified — single-column `.screen`, buttons/inputs min-height 48px |
| No `<a>` wrapping `<button>`; `:focus-visible`; inputs labeled | Verified — host home now uses a `.button-link` anchor; `input:focus-visible` ring; real `<label>`s added to email/password/nickname/URL/session-name + `aria-label` on the inline edit input |
| typecheck / lint / build pass | Verified — `npm run typecheck` (0 errors), `npm run lint` (0 issues), `npm run build` (ok) |
| No backend changes; backend suite passes | Verified — backend untouched; `uv run pytest` = 163 passed, `uv run pyright` = 0 errors |

Extra verification performed:

- Live smoke through the Vite dev proxy against PostgreSQL: register → login →
  create session → list → QR (SVG) → snapshot → start (ACTIVE) → end (ENDED)
  all propagate through `localhost:5173/api`; all SPA routes 200; labels
  present in the built bundle.
- Agent wiring: coder.md and reviewer.md both instruct loading `frontend-ui`
  for frontend work/reviews; plan.md gains the quality-bar section + M9.1.

## Files changed (M9.1)

```text
.opencode/skills/frontend-ui/SKILL.md      (new — the frontend UI skill)
.opencode/agent/coder.md                   (+ load frontend-ui for UI work)
.opencode/agent/reviewer.md                (+ load frontend-ui for UI reviews)
plan.md                                    (+ UI quality bar section, M9.1 milestone,
                                            milestone overview + dev order)
frontend/src/index.css                     (design tokens as CSS variables)
frontend/src/App.css                       (token-driven component styles)
frontend/src/features/host/HostAuthScreen.tsx (labels, brand header, removed
                                            "Clear saved login" dev control)
frontend/src/features/host/HostHomeScreen.tsx (label, .button-link instead of
                                            <a><button>, styled list)
frontend/src/features/host/HostDashboardScreen.tsx (aria-label on edit input,
                                            clearer playback status)
frontend/src/features/join/JoinScreen.tsx  (nickname label)
frontend/src/features/submit/SubmitSongScreen.tsx (YouTube link label)
docs/PROJECT_BRAIN.md                      (M9.1 milestone, decisions, structure)
docs/ARCHITECTURE.md                       (frontend rules, milestone list)
docs/DEV_BRAIN.md                          (updated, this file)
docs/RUNBOOK.md                            (M9.1 checklist)
```

## Implementation notes (M9.1)

- **Skill-first:** the `frontend-ui` skill is the single source of truth for
  frontend quality. It defines design tokens (colors, spacing, radius, type
  scale), the two-surface layout rules (mobile-first participant vs
  projector/TV host), component patterns (buttons/cards/badges/inputs/rows/
  states), accessibility (AA contrast, focus-visible, labels, semantic HTML),
  and a per-change Definition of Done.
- **Tokens live in `index.css`:** `:root` variables only; `App.css` consumes
  them. No screen hard-codes a color or spacing value anymore.
- **a11y fixes:** all text inputs now have real `<label>`s or `aria-label`;
  focus is visible on inputs and buttons via `:focus-visible`; the invalid
  `<a>`-wrapping-`<button>` nesting on the host home was replaced by a
  `.button-link` anchor styled like a button.
- **No scope creep:** no new dependencies, no state management, no backend
  edits, no design overhaul — the existing dark theme was formalized, not
  replaced.

## Tests added (M9.1)

- None (frontend + config/docs only; no behavior changed). Backend suite
  unchanged: **163 passed**.

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

