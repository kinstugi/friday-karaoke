# PRODUCT_SPEC.md — Friday Karaoke

Behavioral contract for the MVP, frozen at milestone **M1**.
This document is the single source of truth for *what the product does*.
Implementers must follow it without guessing. If a behavior is not described here,
it is out of MVP scope (see §12) unless a later milestone explicitly extends this spec.

Companion documents:

- `docs/DOMAIN_MODEL.md` — entities and state enums referenced below
- `docs/API_CONTRACT.md` — planned API surface (updated when endpoints land)
- `docs/DECISIONS.md` — rationale for the behavioral decisions recorded here
- `plan.md` — milestone plan (M1 defines this document)

---

## 1. Scope

The MVP is a private karaoke queue application for one school's Friday karaoke
night:

- **One host** runs the night from a desktop/projector screen.
- **Participants** join anonymously from their phones by scanning a QR code,
  submit songs by pasting YouTube URLs, and watch their queue position.
- Songs play through the **host's browser** (the playback device). Participants'
  phones never play audio.
- Song flow is **automated** (cooldown → countdown → song), with the host able to
  override anything at any time.
- A session supports **multiple rounds**; after each round, participants are asked
  whether they want to join the next one (default: YES).

## 2. Roles and authority matrix

| Role | Identity | Can do |
| ---- | -------- | ------ |
| Host | Account (email/password, M3). One host owns a session. | Create/start/pause/resume/end session; display QR; monitor queue; remove any entry; edit any song URL; skip; manually advance; start next round |
| Participant | Session-scoped identity: nickname + opaque token (M5). No account. | Join; submit songs; review metadata; cancel own WAITING entries; view queue and position; answer next-round prompt |

| Action | Host | Participant |
| ------ | :--: | :---------: |
| Create / start / pause / resume / end session | ✅ | ❌ |
| Display QR / join code | ✅ | ❌ |
| Join session | — | ✅ |
| Submit song (queue entry) | ❌ | ✅ |
| Review song metadata before submitting | — | ✅ |
| Cancel own WAITING entry | ❌ (but can remove any) | ✅ |
| Remove any queue entry | ✅ | ❌ |
| Edit a song URL (re-fetch metadata) | ✅ | ❌ |
| Skip current singer / manually advance | ✅ | ❌ |
| Answer next-round prompt | — | ✅ (default YES) |
| Start next round | ✅ | ❌ |

Rule: **Host actions are authorized server-side** against the owning host account.
**Participant actions are authorized server-side** against the participant token.

## 3. Session lifecycle

States (`SessionStatus` in `docs/DOMAIN_MODEL.md`):

```text
CREATED -> ACTIVE <-> PAUSED -> ROUND_COMPLETE -> ENDED
```

The diagram shows the **normal path**. `ENDED` is reachable from any state
(§5.7, E11, E18) — the host may end the session at any time; the diagram only
shows the typical progression.

| State | Meaning | Join allowed? | Queue processes? |
| ----- | ------- | :-----------: | :--------------: |
| `CREATED` | Session created; QR/join code shown immediately | ✅ (early birds may join and queue) | ❌ (no automation until start) |
| `ACTIVE` | Host started; automation runs | ✅ | ✅ |
| `PAUSED` | Host paused automatic progression | ✅ | ❌ automation (manual host actions still work) |
| `ROUND_COMPLETE` | Current round's queue exhausted; enrollment prompt active | ✅ | ❌ (new round required) |
| `ENDED` | Session closed for good | ❌ (QR/link returns "session ended") | ❌ |

Rules:

- Creating a session immediately produces a **join code** and **join URL/QR**
  (M4/M5). The QR never changes for the lifetime of the session.
- Only the owning host can change session state. Every state change is a server-side
  transition; the frontend merely renders it.
- `ENDED` is terminal. A new night requires a new session.

## 4. Round lifecycle

A session contains one or more rounds. Rounds are numbered 1, 2, 3, ….

```text
Host starts round N
  -> participants submit entries (queue forms by submission order)
  -> automation advances the queue (cooldown/countdown/song)
  -> queue becomes empty
  -> Round N complete -> enrollment prompt for Round N+1
  -> Host starts Round N+1 (YES participants form the new queue)
```

### Queue ordering

- **Within a round**: queue order is the order in which entries were submitted
  (creation order). The backend derives positions from this; there is no mutable
  position field.
- **Between rounds**: the Round N+1 queue is the list of participants who are
  enrolled (answered YES) for Round N+1, ordered deterministically:

  1. Explicit YES answers first, in the order the answers were received.
  2. Default-YES participants (no answer) appended in participant-creation order,
     resolved when the host starts the round.

  This order is fixed by the backend at round start; participants see their new
  position immediately.

  **Interleaving with submissions during round N+1:** the enrollment order fixes the
  relative order of enrolled participants. When an enrolled participant submits a
  song for round N+1 (at any time during the round), their entry is placed ahead of
  every entry from non-enrolled participants, at the position determined by the
  enrollment order. Entries from participants who are **not** enrolled (e.g.,
  students who join mid-round) append in submission order after all enrolled
  entries. A participant who answered **NO** for round N+1 is excluded from that
  round and cannot submit entries into it; they rejoin at the next enrollment.

### Next-round enrollment

- At round completion, the session enters `ROUND_COMPLETE` and every participant
  in the session (who joined before round start) receives the prompt
  "Join the next round?" with **YES** / **NO**.
- **Default: YES.** Not answering counts as YES.
- Explicit **NO** excludes the participant from the next round (they can still
  rejoin by answering YES for the round after that).
- Participants who join *after* round N started are not asked about round N+1
  enrollment retroactively; they join round N+1 normally (their entries land in
  whichever round is active when they submit).

## 5. Host flow (detailed)

### 5.1 Login
1. Host opens the app and logs in (email/password, M3).
2. On success the host lands on the **dashboard** screen.

### 5.2 Create session
1. Host taps **New Session**.
2. Host optionally sets a **session name** (default: `Friday Karaoke - <date>`).
3. Backend creates the session (`CREATED`) and returns a join code + join URL.
4. Dashboard immediately shows the **QR code** and join code; host displays it on
   the projector.

### 5.3 Monitor queue
1. Dashboard shows: current singer, current song + playback status, next singer,
   full queue (participant names, song titles, durations), and session state.
2. The screen refreshes from realtime events (M10); it is never authoritative.

### 5.4 Start the session
1. Host taps **Start** once participants have joined.
2. Session → `ACTIVE`. Automation takes over the queue (see §10).

### 5.5 Moderate (during the night)
- **Skip**: mark the current entry `SKIPPED` and advance to the next entry.
- **Manually advance**: mark the current entry `COMPLETED` and move to the next
  entry (used when the singer finished early).
- **Remove**: remove any queue entry (status `REMOVED`); the entry disappears from
  the queue. Removing the current singer also advances playback.
- **Edit song**: replace the URL of an entry; backend re-validates and re-fetches
  metadata; the entry keeps its position and participant. Invalid replacement is
  rejected with an error and the old URL is kept.
- **Pause / Resume**: pause stops automatic progression after the current song;
  resume restarts automation.
- **End session**: closes the session for good (`ENDED`).

### 5.6 Finish round / start next round
1. When the queue empties, the round completes automatically → `ROUND_COMPLETE`.
2. Host sees enrollment status (who said YES/NO; pending counts as YES).
3. Host taps **Start Next Round** → new round begins with enrolled participants.
4. Host may instead tap **End Session**.

### 5.7 End session
1. Host ends the session → `ENDED`. QR/link no longer accepts joins.
2. The host dashboard shows a summary and returns to the home screen.

## 6. Participant flow (detailed)

### 6.1 Scan QR
1. Student scans the QR (or opens the join URL) with their phone.
2. If the session is `ENDED` → "This karaoke night has ended."
3. Otherwise the participant lands on the **join screen**.

### 6.2 Enter nickname
1. Participant enters a nickname.
2. Rules: required; trimmed; 1–20 characters; unique per session
   (case-insensitive). Violations show a message and block submission.

### 6.3 Paste YouTube URL
1. Participant pastes a YouTube URL (watch URL or youtu.be short URL).
2. Backend validates the URL format and extracts the video ID. Invalid/non-YouTube
   URLs are rejected with an error. (Details: `plan.md` §M6, rules in §8.)
3. Backend fetches metadata (title, channel, duration, thumbnail).
   - Unavailable videos → error, no entry created.
   - **Long videos produce a warning, never a rejection.**

### 6.4 Review song metadata
1. Participant sees a preview: thumbnail, title, channel, duration, and any warning
   (e.g., "This video is longer than usual").
2. Participant confirms **Add to Queue** (or **Try Another URL**).

### 6.5 Join the queue
1. On confirm, the backend creates the queue entry (`WAITING`) in the active round.
2. If the participant has reached the **active-entry limit** (see §8, rule E2), the
   submission is rejected with a clear message.
3. The participant lands on the **queue screen**.

### 6.6 Monitor position
1. Queue screen shows: session status, current singer, next singer, the full queue,
   and "your position".
2. Position is computed by the backend from authoritative queue order.

### 6.7 Receive "you're next"
1. When the participant's entry is promoted to `NEXT`, they receive a notification:
   "You're next! Get ready: <song> — <channel>".
2. Notification timing is configurable (default: when promoted to NEXT, and again
   at the start of the countdown).

### 6.8 Perform
1. When their song starts, the participant sings along (audio plays on the host
   device; the participant's phone shows their song/position only).

### 6.9 Answer the next-round prompt
1. After the round ends, the participant's queue screen shows "Join the next round?"
   with YES / NO buttons.
2. Default if they do nothing: YES.
3. NO removes them from the next round's queue (their entries do not carry over).

## 7. Screen inventory (UX requirements)

### 7.1 Participant: join screen
- Session name, "Scan to join" branding, nickname input, join button, error states.
- Mobile-first, large touch targets (≥ 44px).

### 7.2 Participant: song submit screen
- URL input, submit button, loading state while metadata is fetched, preview card
  (thumbnail/title/channel/duration + warnings), confirm/cancel buttons.

### 7.3 Participant: queue screen
- Session status banner; "Now singing" card; "Up next" card; queue list with each
  entry's song title and participant name; the participant's own entries highlighted
  with their position; the next-round prompt when the round completes.
- Reconnect/loading/error states (see §8, P-edge cases).

### 7.4 Host: dashboard
- Current singer + song + playback status; queue list (names, titles, durations);
  per-entry actions (remove, edit); global actions (start, pause/resume, skip,
  advance, start next round, end session); QR + join code display (post-creation).
- Must be usable on a projector/TV (large text, high contrast, minimal scrolling
  for current/next).
- Must handle browser-autoplay restrictions: playback begins only after host
  interaction; the UI must surface "click to start audio" where needed.

## 8. Edge-case catalog

Every edge case lists the **behavior** an implementer must produce.

### E1. Duplicate song
- Two participants submit the same video (same video ID).
- Behavior: both entries are allowed. The submitter sees an informational notice
  ("This song is already in the queue") but the entry is **not** blocked.

### E2. Participant leaves / abandons
- A participant who leaves (closes browser, navigates away, walks off) keeps their
  queue entries.
- Behavior: entries persist; the queue is unchanged. An entry is only removed by:
  participant cancel, host remove, or being processed (completed/skipped) as the
  queue advances. A participant who is `NEXT`/`SINGING` and does not show up can be
  skipped by the host.

### E3. Participant submits an invalid URL
- Behavior: rejected with a clear error message ("That doesn't look like a valid
  YouTube link"). No entry is created.

### E4. YouTube video unavailable at submission
- Behavior: rejected with "We couldn't load this video." No entry is created.
- (Distinct from E3: format is valid but metadata cannot be fetched.)

### E5. Video becomes unavailable after submission
- The entry already exists in the queue.
- Behavior: the entry stays until reached. When playback of that video fails, the
  host dashboard shows a player error; the host can skip or edit the entry. The
  queue order is never auto-modified.

### E6. Host removes a participant (or their entry)
- Behavior: host removes the entry (status `REMOVED`). Removing the current entry
  advances playback to the next. The participant remains connected and can submit
  again (if below the active-entry limit).

### E7. Host edits a song
- Behavior: host replaces the URL; backend re-validates + re-fetches metadata.
  Invalid replacement → error, previous URL kept. Participant and queue position
  are preserved.

### E8. Participant refreshes the page
- Behavior: nothing is lost. The participant token persists (cookie/storage, M5);
  the page re-fetches authoritative state on load.

### E9. Participant loses internet
- Behavior: their entries remain in the backend. On reconnect, the app re-fetches
  authoritative state and re-establishes the realtime connection. Nothing the
  client did locally is trusted.

### E10. Host loses internet
- Behavior: the backend session state is untouched. Realtime clients keep their
  last-known state but are not authoritative. When the host reconnects, the
  dashboard re-syncs from the backend. Playback on the host device may have
  stopped; the host resumes manually.

### E11. Host closes the browser
- Behavior: the session **remains** in its last state (`ACTIVE`/`PAUSED`/…) in the
  backend. The host reopens the dashboard, logs in, and re-syncs. Sessions are not
  tied to a live browser connection.

### E12. Song ends
- Behavior: normal automation — the entry becomes `COMPLETED`, the backend advances
  through cooldown → countdown → next song (see §10). The host can intervene.

### E13. Host manually skips
- Behavior: current entry → `SKIPPED`; automation advances to the next entry
  immediately (skip bypasses the current song's remaining time).

### E14. Host manually advances
- Behavior: current entry → `COMPLETED`; automation advances to the next entry.
  Used when the singer finished early.

### E15. Queue becomes empty (round ends)
- Behavior: round completes automatically → `ROUND_COMPLETE`; the enrollment prompt
  opens (see §4). Automation stops; nothing auto-advances until the host starts the
  next round.

### E16. Round ends
- Behavior: as E15 plus: participants are asked to enroll for the next round; the
  host sees enrollment status and decides: start next round or end session.

### E17. Participant does not answer the next-round prompt
- Behavior: default **YES**. The participant is enrolled when the host starts the
  next round (see §4 ordering).

### E18. Session ends while participants are connected
- Behavior: their queue screens show "This karaoke night has ended." Entries are
  preserved in the backend for audit/debug but no longer actionable.

### E19. Two participants submit at the same instant
- Behavior: the backend serializes submissions; order is the backend's processing
  order (creation order). Deterministic, no ties by client clock.

### E20. Host skips while an automatic transition is running
- Behavior: only one transition happens. The backend applies the host's action and
  cancels any in-flight automation (see §10). No double-advance.

### E21. Participant cancels while host removes the same entry
- Behavior: both resolve to the entry being terminal; whichever is applied first
  wins and the second is a no-op. The system always ends in a valid queue state.

### E22. Session is PAUSED and the queue has entries
- Behavior: automation is suspended after the current song. Participants can still
  join and submit; host manual actions still work; resume restarts automation.
- Pausing during a transition (PREPARING / COUNTDOWN / COOLDOWN) holds automation
  at that step until resume; the current entry is unaffected.

### E23. No participants joined and the host starts anyway
- Behavior: session → `ACTIVE` with an empty queue; dashboard shows an empty state
  ("Waiting for singers"). Nothing breaks; the round only completes when entries
  are processed (host can end the session at any time).

### E24. Playback fails to start (autoplay / player error)
- Behavior: the host dashboard shows an error and a manual start control; the
  backend playback state does not deadlock — the host can skip/advance/retry.

## 9. Behavioral rules (implementer-facing)

> These are the normative rules extracted from the flows and edge cases. Every rule
> must be enforced by the **backend**; the frontend only renders.

- **B1.** Only authenticated, session-owning hosts can create/start/pause/resume/end
  a session or moderate its queue. (`plan.md` §5 rules 1, 19)
- **B2.** Anyone with the session QR/join link can join; participants need no
  account. (`plan.md` §5 rule 2)
- **B3.** A participant may cancel their own WAITING entry but may not modify or
  cancel others' entries. (`plan.md` §5 rule 5)
- **B4.** The host may remove any entry and edit any entry's YouTube URL.
  (`plan.md` §5 rules 6, 7)
- **B5.** Invalid YouTube URLs cannot be queued. (`plan.md` §5 rule 8)
- **B6.** Long videos produce a warning, never automatic rejection.
  (`plan.md` §5 rule 9; `plan.md` §1.5)
- **B7.** Queue order is authoritative backend state derived from entry creation
  order. No mutable position field. (`plan.md` §5 rule 10)
- **B8.** Host playback is authoritative for actual song playback. Participant
  devices never play audio. (`plan.md` §5 rule 11; §1.6)
- **B9.** Automatic advancement is a fallback/normal path that the host can always
  override (skip, finish, pause, manually start another entry).
  (`plan.md` §5 rules 4, 12; §M13)
- **B10.** A session contains multiple rounds; do not create a new session per
  round. (`plan.md` §5 rule 13; §M16)
- **B11.** At round completion, participants are asked whether they want the next
  round; default answer is YES; explicit NO excludes them.
  (`plan.md` §5 rules 14–16)
- **B12.** Realtime events are delivery, not truth; reconnecting clients must
  resync from the backend. (`plan.md` §5 rules 17, 18; §M10)
- **B13.** The application must remain usable if realtime connections fail.
  (`plan.md` §5 rule 20)
- **B14.** Nicknames are required, trimmed, 1–20 characters, unique per session
  (case-insensitive). (Decision D16)
- **B15.** A participant's **active-entry limit** is 2 non-terminal entries
  (WAITING + NEXT + SINGING) in the current round. Submissions beyond that are
  rejected with a clear message. (Decision D17; enforcement hardened in M17)
- **B16.** Duplicate songs are allowed; an informational notice is shown, never a
  block. (Decision D15)
- **B17.** Sessions are not tied to a live browser connection; closing the host
  browser does not end the session. (Decision D18)
- **B18.** "Skip" marks the current entry `SKIPPED`; "manually advance" marks it
  `COMPLETED`. Both advance to the next entry immediately. (Decision D20)

## 10. Playback and automation behavior

The backend runs the playback state machine (`docs/DOMAIN_MODEL.md`,
`PlaybackState`). Automation is the normal path; the host can interrupt any step.

```text
NEXT
  -> PREPARING   (load the next entry's video)
  -> COUNTDOWN   (next-singer countdown; notify "you're next")
  -> PLAYING     (host YouTube player plays the song)
  -> COOLDOWN    (post-song cooldown)
  -> NEXT
```

Configuration (per session, defaults per `plan.md` §M13):

| Setting | Default | Meaning |
| ------- | ------- | ------- |
| Post-song cooldown | 10 s | Rest between songs before the next countdown |
| Next-singer countdown | 20 s | Countdown shown before the next song starts |
| Notification timing | On NEXT + at countdown start | When the next singer is notified |

Interruptions (all valid at any point):

- **Skip**: current entry `SKIPPED`; go to NEXT immediately (skip cooldown/countdown).
- **Finish / advance**: current entry `COMPLETED`; go to NEXT.
- **Pause**: hold after the current song; no auto-advance until resume.
- **Manually start an entry**: host selects a specific entry and starts it; the
  previous current entry is marked per host choice (completed/skipped).
- **Player error / autoplay blocked**: playback state does not deadlock; the host
  can retry, skip, or advance (E24).

## 11. Notifications

MVP scope: **in-app notifications** (delivered via the realtime channel and visible
in the participant queue screen; optionally a browser notification where permitted).

- **"You're next"**: shown when the participant's entry is promoted to `NEXT` and
  again at countdown start (timing configurable, §10).
- Message: `You're next! Get ready: <song> — <channel>`.
- **Next-round prompt**: in-app prompt at round completion with YES / NO buttons
  (default YES).
- Web Push is a **later** milestone (M15) and is not part of the M1 contract.

## 12. Non-goals (MVP)

Do not build (also in `plan.md` §6 / PROJECT_BRAIN §13):

- Participant accounts, public session discovery, multi-venue management
- Song streaming, Spotify integration, custom karaoke music hosting
- Voting, leaderboards, payments/tipping, social profiles, complex analytics
- AI recommendations / AI singing analysis
- Full offline karaoke operation (reconnect/resync only, M19)

## 13. Open questions

Tracked in `docs/DECISIONS.md` (§ Open questions). None block implementation of M2+.
