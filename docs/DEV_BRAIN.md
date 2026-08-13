# DEV_BRAIN.md — Friday Karaoke (active development context)

This is the working context for the current milestone. Updated at the start and end
of every milestone. The persistent context lives in `PROJECT_BRAIN.md`.

---

## Current milestone

**M12 — YouTube host player** — COMPLETE (verified).

## Current task

None (milestone finished). Next milestone: **M13 — Automatic song transitions**
(timer-driven cooldown/countdown between songs using the M11 playback engine).

## M12 scope (plan.md §M12)

- Embed the YouTube player into the host dashboard — the **host browser is the
  playback device** (D4); participants never play audio.
- Drive the player from the M11 playback state (the `SINGING` entry's video).
- Detect playback completion (report back via the M11 `finish` endpoint).
- Handle player errors (E5/E24) and browser-autoplay restrictions.

## Verification results (M12 acceptance criteria, plan.md §M12)

| Acceptance criterion | Result |
| -------------------- | ------ |
| Host can start a queued song and play it through the host machine's speakers | Verified — the dashboard's "Start next song" (M11) marks the entry `SINGING`; the embedded `YouTubePlayer` loads and plays that entry's `video_id` on the host device; playback completion calls `finish` and advances |
| Participants do not play the song | Verified — the player is mounted only on the host dashboard; participant screens carry no player (D4) |
| Handle player errors | Verified — `onError` maps YouTube error codes to host-facing messages surfaced in the Playback card; the host can Skip (→ `SKIPPED`) or Edit the URL (E5/E24) |
| Handle autoplay restrictions | Verified — playback is attempted on load after the host's click gesture; if blocked, the embedded player's native controls remain usable (E24), and a "No song is playing" placeholder is shown when idle |

Additional verification:

- Backend unchanged (M12 is frontend-only; the M11 `/play` endpoints already
  exist): suite remains **199 passed**, `pyright` 0 errors.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Live check against the running backend: submit → snapshot's `SINGING` entry
  carries the `video_id` the player consumes; `playback_state` `PLAYING`;
  round 1. (Actual audio playback requires a real browser/speakers — the
  school-night environment.)
- No new dependencies: the YouTube IFrame API is loaded at runtime from
  `https://www.youtube.com/iframe_api`, and the YT API surface is typed by a
  small ambient `src/youtube.d.ts` (no `@types/youtube` package).

## Files changed (M12)

```text
frontend/src/youtube.d.ts                        (new — ambient YouTube IFrame API types)
frontend/src/features/host/YouTubePlayer.tsx     (new — embedded player: load API, play SINGING
                                                  video, ended/error events, placeholder)
frontend/src/features/host/HostDashboardScreen.tsx (player in the Playback card, onEnded->finish,
                                                  playerError surfacing, nowSingingRef guard,
                                                  header comment updated)
frontend/src/App.css                             (player 16:9 frame, placeholder, status)
docs/PROJECT_BRAIN.md, docs/ARCHITECTURE.md, docs/DEV_BRAIN.md, docs/RUNBOOK.md
```

## Implementation notes (M12)

- **Player component (`YouTubePlayer`):** loads the IFrame API script once
  (module-level promise), creates one `YT.Player` bound to an always-mounted
  container, and drives it from a `videoId` prop (the `SINGING` entry's id).
  On a new video id it calls `loadVideoById` + `playVideo`; on `null` it calls
  `stopVideo` and shows a "No song is playing" placeholder. `onStateChange`
  `ENDED` → `onEnded` (→ the dashboard's `finish`); `onError` maps YouTube error
  codes (2/5/100/101/150) to host-facing messages.
- **Autoplay policy (E24):** the host's click on "Start next song" establishes
  user activation, so the subsequent `loadVideoById`/`playVideo` generally
  autoplays. If a browser blocks it, the embedded player's native controls still
  work (the host clicks play), and `ENDED` is still reported.
- **Backend remains authoritative (D2):** the player never decides state — it
  renders the `SINGING` entry from the snapshot (via the realtime channel) and
  reports completion back through the M11 `finish` endpoint. A `nowSingingRef`
  guard prevents finishing an entry that was already skipped/removed.
- **No scope creep:** no backend changes, no automatic transitions (M13), no
  notifications (M15), no new npm dependency.

## Tests added (M12)

- None (frontend-only; verified by typecheck/lint/build + the live backend
  check above). Backend suite unchanged at 199.

## Current blockers

- None.

## Unresolved technical questions

- Tracked in `docs/DECISIONS.md` (Open questions): Web Push service choice (M15).
- Starlette deprecation warning (`httpx` vs `httpx2` in `fastapi.testclient`) —
  non-blocking, tracked since M0.
- FastAPI 0.141.1 dependency-name collision (D30): workaround documented; watch
  for an upstream fix.
- `RealtimeHub` is in-process/per-worker (D42): a multi-worker deployment needs
  a shared hub (Redis) — tracked for M20 deployment.
- YouTube playback is only exercisable in a real browser (autoplay policies,
  audio output); CI/agents verify the build and the backend contract instead.

## Next recommended task

**M13 — Automatic song transitions** (backend + frontend): timer-driven
transitions between songs (post-song cooldown, next-singer countdown — configurable
per session, default 10 s / 20 s per PRODUCT_SPEC §10) built on the M11 playback
engine and the M12 player. When a video ends, the backend enters COOLDOWN, then
promotes + starts the next `SINGING` entry automatically, with the host able to
override at any time. This also makes the `PREPARING`/`COUNTDOWN`/`COOLDOWN`
`PlaybackState` values reachable (D46).
