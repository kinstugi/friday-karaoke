// Host participant management: a separate PC-first screen where the host can
// see singers and their queued playlists, create no-phone participants, and add
// songs to them without changing the main playback dashboard flow.
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import {
  addHostParticipantSong,
  createHostParticipant,
  fetchHostParticipants,
  fetchSession,
} from '../../api/host'
import type { HostParticipantDetail, HostParticipantEntry, Session } from '../../api/types'
import { formatDuration } from '../../lib/format'
import { loadHostIdentity } from '../../lib/hostToken'
import { statusLabel } from '../../lib/session'
import { useRealtime } from '../../ws/useRealtime'

const POLL_INTERVAL_MS = 5000

function entryStatusLabel(status: HostParticipantEntry['status']): string {
  switch (status) {
    case 'WAITING':
      return 'Waiting'
    case 'NEXT':
      return 'Next up'
    case 'SINGING':
      return 'Now singing'
    case 'COMPLETED':
      return 'Done'
    case 'SKIPPED':
      return 'Skipped'
    case 'CANCELLED':
      return 'Cancelled'
    case 'REMOVED':
      return 'Removed'
  }
}

export default function HostParticipantsScreen() {
  const { sessionId = '' } = useParams()
  const [identity] = useState(loadHostIdentity)

  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<HostParticipantDetail[] | null>(null)
  const [nickname, setNickname] = useState('')
  const [songUrls, setSongUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    if (!identity) return
    try {
      const [loadedSession, loadedParticipants] = await Promise.all([
        fetchSession(identity.token, sessionId),
        fetchHostParticipants(identity.token, sessionId),
      ])
      setSession(loadedSession)
      setParticipants(loadedParticipants)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load participants')
    }
  }, [identity, sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (connected || !identity) return
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [connected, identity, refresh])

  useRealtime(sessionId, identity?.token ?? '', {
    onEvent: (event) => {
      if (
        event.type === 'QueueUpdated' ||
        event.type === 'ParticipantJoined' ||
        event.type === 'SessionUpdated'
      ) {
        void refresh()
      }
    },
    onStatusChange: (isConnected) => {
      setConnected(isConnected)
      if (isConnected) void refresh()
    },
  })

  if (!identity) {
    return <Navigate to="/host/login" replace />
  }

  const ended = session?.status === 'ENDED'

  async function handleCreateParticipant(event: FormEvent) {
    event.preventDefault()
    if (!identity || busy || nickname.trim() === '') return
    setBusy('create')
    setError(null)
    setNotice(null)
    try {
      const participant = await createHostParticipant(identity.token, sessionId, nickname.trim())
      setNickname('')
      setNotice(`${participant.nickname} was added to the session.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this singer')
    } finally {
      setBusy(null)
    }
  }

  async function handleAddSong(event: FormEvent, participant: HostParticipantDetail) {
    event.preventDefault()
    if (!identity || busy) return
    const youtubeUrl = (songUrls[participant.id] ?? '').trim()
    if (youtubeUrl === '') return
    setBusy(`song:${participant.id}`)
    setError(null)
    setNotice(null)
    try {
      const result = await addHostParticipantSong(
        identity.token,
        sessionId,
        participant.id,
        youtubeUrl,
      )
      setSongUrls((prev) => ({ ...prev, [participant.id]: '' }))
      setNotice(`Added “${result.entry.title}” for ${participant.nickname}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this song')
    } finally {
      setBusy(null)
    }
  }

  if (!session || !participants) {
    return (
      <div className="host-dashboard">
        <div className="card host-loading-card">
          <p className="label">Participants</p>
          <h1>Loading singers…</h1>
          <p className="muted">
            {error ?? 'Preparing the host participant view.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="host-dashboard host-participants">
      <header className="host-header">
        <div className="host-title">
          <p className="label">Participant management</p>
          <h1>{session.name}</h1>
          <div className="row">
            <p className={`badge badge-${session.status.toLowerCase()}`}>
              {statusLabel(session.status)}
            </p>
            <Link className="button-link" to={`/host/sessions/${sessionId}`}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="card stack">
        <div>
          <p className="label">Add a singer</p>
          <h2>No phone? Add them here.</h2>
          <p className="muted">
            Host-created singers follow the normal absent cleanup rules.
          </p>
        </div>
        <form className="row participant-create" onSubmit={(event) => void handleCreateParticipant(event)}>
          <div className="field participant-name-field">
            <label htmlFor="host-participant-nickname">Nickname</label>
            <input
              id="host-participant-nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Singer nickname"
              disabled={ended || busy !== null}
              maxLength={20}
              required
            />
          </div>
          <button type="submit" disabled={ended || busy !== null || nickname.trim() === ''}>
            {busy === 'create' ? 'Adding…' : 'Add singer'}
          </button>
        </form>
      </section>

      {notice ? (
        <div className="card success" role="status">
          {notice}
        </div>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}

      <section className="host-participant-list">
        <h2>Singers</h2>
        {participants.length === 0 ? (
          <div className="card">
            <p className="muted">No singers yet — add the first one above.</p>
          </div>
        ) : (
          participants.map((participant) => (
            <article className="card stack participant-card" key={participant.id}>
              <div className="row participant-card-head">
                <div>
                  <p className="label">Singer</p>
                  <h2>{participant.nickname}</h2>
                </div>
                <p className="badge badge-round">
                  {participant.entries.length} queued
                </p>
              </div>

              <form
                className="row participant-song-form"
                onSubmit={(event) => void handleAddSong(event, participant)}
              >
                <div className="field participant-song-field">
                  <label htmlFor={`song-url-${participant.id}`}>YouTube link</label>
                  <input
                    id={`song-url-${participant.id}`}
                    type="url"
                    value={songUrls[participant.id] ?? ''}
                    onChange={(event) =>
                      setSongUrls((prev) => ({
                        ...prev,
                        [participant.id]: event.target.value,
                      }))
                    }
                    placeholder="Paste a YouTube link"
                    disabled={ended || busy !== null}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    ended ||
                    busy !== null ||
                    (songUrls[participant.id] ?? '').trim() === ''
                  }
                >
                  {busy === `song:${participant.id}` ? 'Adding…' : 'Add song'}
                </button>
              </form>

              {participant.entries.length === 0 ? (
                <p className="muted">No queued songs yet.</p>
              ) : (
                <ol className="queue-list participant-playlist">
                  {participant.entries.map((entry) => (
                    <li key={entry.id}>
                      <span className="position">{entry.position ?? '—'}</span>
                      <div className="entry-main">
                        <strong>{entry.title}</strong>
                        <span className="muted">
                          Round {entry.round_number} &middot; {entryStatusLabel(entry.status)} &middot;{' '}
                          {formatDuration(entry.duration_seconds)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  )
}
