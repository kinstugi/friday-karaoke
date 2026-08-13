// Participant queue screen (PRODUCT_SPEC §6.6/§7.3): subscribes to the session's
// realtime channel (M10) and renders the session status, now/next cards, and the
// queue with the participant's own entries highlighted. The backend is the source
// of truth — this screen only renders what it returns. While the WebSocket is
// disconnected it falls back to polling the authoritative snapshot (D5/B13).
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { cancelEntry, fetchQueueSnapshot } from '../../api/entries'
import type { QueueEntry, QueueSnapshot } from '../../api/types'
import { formatDuration } from '../../lib/format'
import { statusLabel } from '../../lib/session'
import { loadIdentity } from '../../lib/token'
import { useRealtime } from '../../ws/useRealtime'

const POLL_INTERVAL_MS = 5000

export default function QueueScreen() {
  const { joinCode = '' } = useParams()
  // Read the stored identity once so its reference (and thus the polling
  // effect below) stays stable across renders (avoids a fetch loop).
  const [identity] = useState(loadIdentity)

  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    if (!identity) return
    try {
      setSnapshot(await fetchQueueSnapshot(identity.sessionId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the queue')
    }
  }, [identity])

  // Initial authoritative fetch; the live channel and the fallback poll below
  // keep the screen fresh afterwards.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Fallback while realtime is unavailable (B13): poll the authoritative
  // snapshot so the screen still updates if the WebSocket fails.
  useEffect(() => {
    if (connected) return
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [connected, refresh])

  useRealtime(identity?.sessionId ?? '', identity?.token ?? '', {
    onEvent: (event) => {
      if (event.type === 'QueueUpdated') {
        setSnapshot(event.snapshot)
      } else if (event.type === 'SessionUpdated') {
        // The snapshot carries the session status too; keep it in sync so the
        // ended banner appears without a queue mutation (M10).
        setSnapshot((prev) =>
          prev ? { ...prev, status: event.status } : prev,
        )
      }
    },
    onStatusChange: (isConnected) => {
      setConnected(isConnected)
      // D5: re-fetch authoritative state when the socket (re)connects.
      if (isConnected) void refresh()
    },
  })

  async function handleCancel(entry: QueueEntry) {
    if (!identity) return
    try {
      await cancelEntry(entry.id, identity.token)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the entry')
    }
  }

  if (!identity || identity.joinCode.toLowerCase() !== joinCode.toLowerCase()) {
    return <Navigate to={`/join/${joinCode}`} replace />
  }

  if (!snapshot) {
    return (
      <div className="screen">
        <p className="muted">{error ?? 'Loading queue…'}</p>
      </div>
    )
  }

  const ended = snapshot.status === 'ENDED'
  const nowSinging = snapshot.queue.find((e) => e.status === 'SINGING')
  // "Up next" is the first queued entry that is not the current singer: the
  // backend's NEXT entry when one exists, otherwise the first WAITING entry.
  const upNext = snapshot.queue.find(
    (e) => e.id !== nowSinging?.id && e.status !== 'SINGING',
  )
  const myEntries = snapshot.queue.filter(
    (e) => e.participant_name === identity.nickname,
  )

  return (
    <div className="screen">
      <header className="topbar">
        <span className="session-name">{identity.sessionName}</span>
        <Link to={`/join/${joinCode}/submit`}>+ Add Song</Link>
      </header>

      <p className={`badge badge-${snapshot.status.toLowerCase()}`}>
        {statusLabel(snapshot.status)}
      </p>

      {ended ? (
        <div className="card">
          <h2>This karaoke night has ended.</h2>
        </div>
      ) : (
        <>
          {nowSinging ? (
            <div className="card highlight">
              <p className="label">Now singing</p>
              <h2>{nowSinging.title}</h2>
              <p className="muted">{nowSinging.participant_name}</p>
            </div>
          ) : null}

          {upNext ? (
            <div className="card">
              <p className="label">Up next</p>
              <h3>{upNext.title}</h3>
              <p className="muted">{upNext.participant_name}</p>
            </div>
          ) : null}

          <section className="queue">
            <h2>Queue</h2>
            {snapshot.queue.length === 0 ? (
              <p className="muted">No songs yet — add the first one!</p>
            ) : (
              <ol className="queue-list">
                {snapshot.queue.map((entry) => {
                  const mine = entry.participant_name === identity.nickname
                  return (
                    <li key={entry.id} className={mine ? 'mine' : ''}>
                      <span className="position">
                        {entry.position ?? '—'}
                      </span>
                      <div className="entry-main">
                        <strong>{entry.title}</strong>
                        <span className="muted">
                          {entry.participant_name} &middot;{' '}
                          {formatDuration(entry.duration_seconds)}
                        </span>
                        {mine && entry.status === 'WAITING' ? (
                          <button
                            className="link-button"
                            onClick={() => void handleCancel(entry)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          {myEntries.length > 0 ? (
            <p className="muted">
              Your position: {myEntries.map((e) => e.position).join(', ')}
            </p>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
        </>
      )}
    </div>
  )
}
