import { useEffect, useState } from 'react'
import { subscribeToSongs, type SessionSong } from '../lib/sessions'

export function useSessionSongs(sessionId: string) {
  const [songs, setSongs] = useState<SessionSong[]>([])
  const [error, setError] = useState('')

  useEffect(() => subscribeToSongs(sessionId, setSongs, (snapshotError) => { console.error('Firestore songs listener failed:', snapshotError); setError(`${snapshotError.name}: ${snapshotError.message}`) }), [sessionId])
  return { songs, error }
}
