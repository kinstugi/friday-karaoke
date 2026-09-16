import { useEffect, useState } from 'react'
import { subscribeToHostSessions, type KaraokeSession } from '../lib/sessions'

export function useHostSessions(hostId: string | undefined) {
  const [sessions, setSessions] = useState<KaraokeSession[]>([])
  const [loading, setLoading] = useState(Boolean(hostId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hostId) { setSessions([]); setLoading(false); return }
    setLoading(true)
    setError('')
    return subscribeToHostSessions(hostId, (nextSessions) => { setSessions(nextSessions); setLoading(false) }, (snapshotError) => { console.error('Firestore sessions listener failed:', snapshotError); setError(`${snapshotError.name}: ${snapshotError.message}`); setLoading(false) })
  }, [hostId])

  return { sessions, loading, error }
}
