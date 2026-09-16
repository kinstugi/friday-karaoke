import { useEffect, useState } from 'react'
import { subscribeToParticipants, type SessionParticipant } from '../lib/sessions'

export function useSessionParticipants(sessionId: string) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    return subscribeToParticipants(sessionId, setParticipants, (snapshotError) => {
      console.error('Firestore participants listener failed:', snapshotError)
      setError(snapshotError.message)
    })
  }, [sessionId])

  return { participants, error }
}
